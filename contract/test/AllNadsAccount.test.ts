import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther, encodeFunctionData, keccak256, stringToHex, concat } from "viem";
import { signMessage } from "viem/accounts";

describe("AllNadsAccount", function () {
  // 部署Token Bound Account的测试夹具
  async function deployAccountFixture() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    
    // 部署注册表合约
    const registryFactory = await hre.viem.deployContract("AllNadsRegistry", []);
    const registry = await hre.viem.getContractAt(
      "AllNadsRegistry",
      registryFactory.address
    );
    
    // 部署账户实现合约
    const accountImplFactory = await hre.viem.deployContract("AllNadsAccount", []);
    const accountImpl = await hre.viem.getContractAt(
      "AllNadsAccount",
      accountImplFactory.address
    );
    
    // 部署测试ERC20代币
    const testTokenFactory = await hre.viem.deployContract("ERC20Mock", ["TestToken", "TT", 18]);
    const testToken = await hre.viem.getContractAt(
      "ERC20Mock",
      testTokenFactory.address
    );
    
    // Deploy libraries first
    const pngHeaderLibFactory = await hre.viem.deployContract("PNGHeaderLib", []);
    const smallSoladyFactory = await hre.viem.deployContract("SmallSolady", []);

    // Deploy the component contract with PNGHeaderLib linked
    const componentFactory = await hre.viem.deployContract("AllNadsComponent", [], {
      libraries: {
        "contracts/lib/PNGHeaderLib.sol:PNGHeaderLib": pngHeaderLibFactory.address
      }
    });
    const component = await hre.viem.getContractAt(
      "AllNadsComponent",
      componentFactory.address
    );
    
    // Deploy the renderer contract without library linking
    const rendererFactory = await hre.viem.deployContract("AllNadsRenderer", [
      component.address,
      "<svg></svg>" // Default body data
    ]);
    const renderer = await hre.viem.getContractAt(
      "AllNadsRenderer",
      rendererFactory.address
    );
    
    // Deploy the AllNads contract
    const testNFTFactory = await hre.viem.deployContract("AllNads", [
      "TestNFT",
      "TNFT",
      registry.address,
      accountImpl.address,
      component.address
    ]);
    
    const testNFT = await hre.viem.getContractAt(
      "AllNads",
      testNFTFactory.address
    );
    
    // Set AllNads as the official minter for the component
    const componentClient = await hre.viem.getContractAt(
      "AllNadsComponent",
      component.address,
      { client: { wallet: owner } }
    );
    
    // Set the official minter
    await componentClient.write.setAllNadsContract([testNFT.address]);
    
    // Create templates for each component type (with payment)
    const templateFee = 10000000000000000n; // 0.01 ETH
    await componentClient.write.createTemplate(
      ["Background", 100n, templateFee, "<svg></svg>", 0], 
      { value: templateFee }
    );
    await componentClient.write.createTemplate(
      ["Hairstyle", 100n, templateFee, "<svg></svg>", 1], 
      { value: templateFee }
    );
    await componentClient.write.createTemplate(
      ["Eyes", 100n, templateFee, "<svg></svg>", 2], 
      { value: templateFee }
    );
    await componentClient.write.createTemplate(
      ["Mouth", 100n, templateFee, "<svg></svg>", 3], 
      { value: templateFee }
    );
    await componentClient.write.createTemplate(
      ["Accessory", 100n, templateFee, "<svg></svg>", 4], 
      { value: templateFee }
    );
    
    // Set the renderer contract in AllNads
    const testNFTClientOwner = await hre.viem.getContractAt(
      "AllNads",
      testNFT.address,
      { client: { wallet: owner } }
    );
    
    // Create a simple renderer with default body data
    await testNFTClientOwner.write.setRendererContract([renderer.address]);
    
    // 测试数据
    const publicClient = await hre.viem.getPublicClient();
    const chainId = 31337n; // Hardhat默认链ID
    const tokenId = 1n;
    const salt = 0n;
    
    // 为测试铸造一个NFT，这是必须的，因为账户绑定到NFT
    const testNFTClient = await hre.viem.getContractAt(
      "AllNads",
      testNFT.address,
      { client: { wallet: owner } }
    );
    
    // For testing, we need to mint an NFT before creating an account for it
    // Mint with the required component parameters
    const componentTx = await testNFTClient.write.mint(
      [
        "Test Nad",     // name
        1n,             // backgroundTemplateId
        2n,             // hairstyleTemplateId
        3n,             // eyesTemplateId 
        4n,             // mouthTemplateId
        5n              // accessoryTemplateId
      ],
      { value: 1000000000000000000n }  // 1 ETH as payment
    );
    await publicClient.waitForTransactionReceipt({ hash: componentTx });
    
    // 使用registry创建账户
    const registryClient = await hre.viem.getContractAt(
      "AllNadsRegistry",
      registry.address,
      { client: { wallet: owner } }
    );
    
    // 获取将创建的账户地址
    const accountAddress = await registry.read.getAccount([
      accountImpl.address,
      chainId,
      testNFT.address,
      tokenId,
      salt
    ]);
    
    console.log("Expected account address:", accountAddress);
    
    // 创建账户
    const createAccountTx = await registryClient.write.createAccount([
      accountImpl.address,
      chainId,
      testNFT.address,
      tokenId,
      salt,
      "0x" // 空初始化数据
    ]);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: createAccountTx });
    console.log("Account creation transaction:", receipt.status);
    
    // Extract the account address from the event logs
    const logs = receipt.logs;
    console.log("Transaction logs:", logs.length);
    
    // Parse the AccountCreated event to get the actual account address
    let actualAccountAddress = accountAddress; // Default to calculated address
    
    for (const log of logs) {
      if (log.address.toLowerCase() === registry.address.toLowerCase()) {
        // This is a log from the registry contract
        // The AccountCreated event has the account address as the first parameter
        // The data format is: account (address), implementation (address), chainId (uint256), tokenContract (address), tokenId (uint256), salt (uint256)
        const data = log.data.slice(2); // Remove 0x prefix
        // First 32 bytes (64 chars) is the account address
        const accountFromLog = '0x' + data.slice(24, 64); // Extract the address (20 bytes) from the 32 byte slot
        console.log("Account address from log:", accountFromLog);
        actualAccountAddress = accountFromLog as `0x${string}`;
      }
    }
    
    console.log("Using account address:", actualAccountAddress);
    
    // Verify the account was created
    const accountExists = await publicClient.getBytecode({ address: actualAccountAddress });
    if (!accountExists) {
      throw new Error(`Account was not created at address: ${actualAccountAddress}`);
    }
    
    console.log("Account created successfully at:", actualAccountAddress);
    
    const tbaContract = await hre.viem.getContractAt(
      "AllNadsAccount",
      actualAccountAddress
    );
    
    // Verify the account is properly initialized
    const tokenInfo = await tbaContract.read.token();
    console.log("Token info:", tokenInfo);
    
    // Log the owner of the NFT
    const nftOwner = await testNFT.read.ownerOf([tokenId]);
    console.log("NFT owner:", nftOwner);
    console.log("Test owner address:", owner.account.address);
    
    // Check if the owner is authorized
    const isOwnerAuthorized = await tbaContract.read.isAuthorized([owner.account.address]);
    console.log("Is owner authorized:", isOwnerAuthorized);
    
    // 向用户1转账一些测试代币
    const testTokenClient = await hre.viem.getContractAt(
      "ERC20Mock",
      testToken.address,
      { client: { wallet: owner } }
    );
    
    // 确保user1有足够的ERC20代币用于测试
    const mintToUser1Tx = await testTokenClient.write.mint([
      getAddress(user1.account.address),
      parseEther("1000")
    ]);
    
    await publicClient.waitForTransactionReceipt({ 
      hash: mintToUser1Tx 
    });
    
    // 创建初始账户余额 - 只发送一次
    const sendEthTx = await owner.sendTransaction({
      to: actualAccountAddress,
      value: parseEther("1")
    });
    
    await publicClient.waitForTransactionReceipt({ 
      hash: sendEthTx 
    });
    
    return {
      registry,
      accountImpl,
      testNFT,
      testToken,
      tbaContract,
      owner,
      user1,
      user2,
      chainId,
      tokenId,
      salt,
      actualAccountAddress,
      publicClient
    };
  }

  describe("Basic Account Functions", function () {
    it("Should return correct token information", async function () {
      const { 
        tbaContract, 
        testNFT, 
        chainId, 
        tokenId
      } = await loadFixture(deployAccountFixture);
      
      const tokenInfo = await tbaContract.read.token();
      
      expect(tokenInfo[0]).to.equal(chainId);
      expect(tokenInfo[1]).to.equal(testNFT.address);
      expect(tokenInfo[2]).to.equal(tokenId);
    });

    it("Should authorize the NFT owner", async function () {
      const { 
        tbaContract, 
        owner
      } = await loadFixture(deployAccountFixture);
      
      const isAuthorized = await tbaContract.read.isAuthorized([owner.account.address]);
      
      expect(isAuthorized).to.be.true;
    });

    it("Should execute a transaction", async function () {
      const { 
        tbaContract, 
        owner,
        actualAccountAddress,
        publicClient
      } = await loadFixture(deployAccountFixture);
      
      // 创建一个客户端用于执行交易
      const tbaClient = await hre.viem.getContractAt(
        "AllNadsAccount",
        tbaContract.address,
        { client: { wallet: owner } }
      );
      
      // 不需要再次发送ETH，因为已经在fixture中发送了
      
      // 检查账户余额
      const balance = await publicClient.getBalance({
        address: actualAccountAddress
      });
      
      expect(balance).to.equal(parseEther("1"));
      
      // 执行一个交易 - 发送ETH给owner
      const recipient = getAddress(owner.account.address);
      const amountToSend = parseEther("0.5");
      
      const executeTx = await tbaClient.write.executeCall([
        recipient,
        amountToSend,
        "0x", // 空数据
        0 // OPERATION_CALL
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: executeTx });
      
      // 检查余额变化
      const newBalance = await publicClient.getBalance({
        address: actualAccountAddress
      });
      
      // 由于gas消耗，我们检查剩余金额约为0.5 ETH
      expect(Number(newBalance)).to.be.lessThan(Number(parseEther("0.6")));
      expect(Number(newBalance)).to.be.greaterThan(Number(parseEther("0.4")));
    });
  });

  describe("Asset Management Functions", function () {
    it("Should transfer ERC20 tokens", async function () {
      const { 
        tbaContract, 
        testToken,
        user1,
        user2,
        actualAccountAddress,
        publicClient
      } = await loadFixture(deployAccountFixture);
      
      // 转账ERC20到TBA
      const testTokenClient = await hre.viem.getContractAt(
        "ERC20Mock",
        testToken.address,
        { client: { wallet: user1 } }
      );
      
      const transferAmount = parseEther("100");
      
      const transferTx = await testTokenClient.write.transfer([
        actualAccountAddress,
        transferAmount
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: transferTx });
      
      // 验证TBA已收到代币
      const tbaBalance = await testToken.read.balanceOf([actualAccountAddress]);
      expect(tbaBalance).to.equal(transferAmount);
      
      // 使用TBA的ERC20转账功能
      const tbaClient = await hre.viem.getContractAt(
        "AllNadsAccount",
        tbaContract.address,
        { client: { wallet: user1 } }
      );
      
      const recipientAddress = getAddress(user2.account.address);
      const amountToTransfer = parseEther("50");
      
      const erc20TransferTx = await tbaClient.write.transferERC20([
        testToken.address,
        recipientAddress,
        amountToTransfer
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: erc20TransferTx });
      
      // 验证代币已转移
      const recipientBalance = await testToken.read.balanceOf([recipientAddress]);
      const newTbaBalance = await testToken.read.balanceOf([actualAccountAddress]);
      
      expect(recipientBalance).to.equal(amountToTransfer);
      expect(newTbaBalance).to.equal(transferAmount - amountToTransfer);
    });

    it("Should batch transfer ERC20 tokens", async function () {
      const { 
        tbaContract, 
        testToken,
        user1,
        user2,
        actualAccountAddress,
        publicClient
      } = await loadFixture(deployAccountFixture);
      
      // 转账ERC20到TBA
      const testTokenClient = await hre.viem.getContractAt(
        "ERC20Mock",
        testToken.address,
        { client: { wallet: user1 } }
      );
      
      const transferAmount = parseEther("100");
      
      const transferTx = await testTokenClient.write.transfer([
        actualAccountAddress,
        transferAmount
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: transferTx });
      
      // 使用批量转账功能
      const tbaClient = await hre.viem.getContractAt(
        "AllNadsAccount",
        tbaContract.address,
        { client: { wallet: user1 } }
      );
      
      const recipientAddress = getAddress(user2.account.address);
      const tokenAddresses = [testToken.address, testToken.address];
      const amounts = [parseEther("30"), parseEther("20")];
      
      const batchTransferTx = await tbaClient.write.batchTransferERC20([
        tokenAddresses,
        recipientAddress,
        amounts
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: batchTransferTx });
      
      // 验证代币已转移
      const recipientBalance = await testToken.read.balanceOf([recipientAddress]);
      const newTbaBalance = await testToken.read.balanceOf([actualAccountAddress]);
      
      expect(recipientBalance).to.equal(parseEther("50")); // 30 + 20
      expect(newTbaBalance).to.equal(parseEther("50")); // 100 - 50
    });
  });

  describe("Fallback Function", function () {
    it("Should reject unauthorized calls to fallback", async function () {
      const { 
        tbaContract, 
        user2
      } = await loadFixture(deployAccountFixture);
      
      // 使用未授权用户创建客户端
      const unauthorizedClient = await hre.viem.getContractAt(
        "AllNadsAccount",
        tbaContract.address,
        { client: { wallet: user2 } }
      );
      
      // 尝试调用一个不存在的函数
      const nonexistentFunctionData = encodeFunctionData({
        abi: [{
          type: 'function',
          name: 'nonexistentFunction',
          inputs: [],
          outputs: [],
          stateMutability: 'nonpayable'
        }],
        functionName: 'nonexistentFunction',
        args: []
      });
      
      // 应该被拒绝，因为user2未授权
      await expect(user2.sendTransaction({
        to: tbaContract.address,
        data: nonexistentFunctionData
      })).to.be.rejectedWith(/NotAuthorized/);
    });

    it("Should emit UnknownCallReceived event for authorized calls", async function () {
      const { 
        tbaContract, 
        owner,
        publicClient
      } = await loadFixture(deployAccountFixture);
      
      // 创建一个不存在的函数调用数据
      const nonexistentFunctionData = encodeFunctionData({
        abi: [{
          type: 'function',
          name: 'nonexistentFunction',
          inputs: [],
          outputs: [],
          stateMutability: 'nonpayable'
        }],
        functionName: 'nonexistentFunction',
        args: []
      });
      
      // 使用授权用户发送交易
      const tx = await owner.sendTransaction({
        to: tbaContract.address,
        data: nonexistentFunctionData
      });
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查事件是否被发出
      const events = await tbaContract.getEvents.UnknownCallReceived();
      
      expect(events.length).to.be.greaterThan(0);
      
      // 验证事件数据
      expect(events[0].args.sender).to.equal(getAddress(owner.account.address));
      expect(events[0].args.data).to.equal(nonexistentFunctionData);
    });

    it("Should increment state when fallback is called", async function () {
      const { 
        tbaContract, 
        owner,
        publicClient
      } = await loadFixture(deployAccountFixture);
      
      // 获取初始状态
      const initialState = await tbaContract.read.state();
      
      // 创建一个不存在的函数调用数据
      const nonexistentFunctionData = encodeFunctionData({
        abi: [{
          type: 'function',
          name: 'nonexistentFunction',
          inputs: [],
          outputs: [],
          stateMutability: 'nonpayable'
        }],
        functionName: 'nonexistentFunction',
        args: []
      });
      
      // 使用授权用户发送交易
      const tx = await owner.sendTransaction({
        to: tbaContract.address,
        data: nonexistentFunctionData
      });
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查状态是否增加
      const newState = await tbaContract.read.state();
      expect(newState).to.equal(initialState + 1n);
    });
  });
}); 