// @ts-nocheck
import { expect, assert } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther, zeroAddress } from "viem";
import { deployPNGHeaderLib } from "./helpers/deployLibraries";

describe("AllNads", function () {
  // 部署所有合约的测试夹具
  async function deployAllNadsFixture() {
    const [owner, creator, buyer] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    
    // 先部署 PNGHeaderLib 库
    const pngHeaderLibFactory = await deployPNGHeaderLib();
    
    // 部署组件合约，链接库
    const component = await hre.viem.deployContract("AllNadsComponent", [], {
      libraries: {
        "contracts/lib/PNGHeaderLib.sol:PNGHeaderLib": pngHeaderLibFactory.address
      }
    });
    
    // 部署账户实现合约
    const account = await hre.viem.deployContract("AllNadsAccount", []);
    // 部署注册表合约
    const registry = await hre.viem.deployContract("AllNadsRegistry", []);
    // 部署渲染器合约
    const renderer = await hre.viem.deployContract("AllNadsRenderer", [
      component.address,
      "DefaultBodyData"
    ]);
    
    // 部署主合约，使用正确的参数顺序
    const allNads = await hre.viem.deployContract("AllNads", [
      "AllNads",              // _name
      "NADS",                 // _symbol
      registry.address,       // _registry
      account.address,        // _accountImplementation
      component.address       // _componentContract
    ]);
    
    await allNads.write.setRendererContract([renderer.address]);
    await component.write.setAllNadsContract([allNads.address]);
    
    // 准备真实的PNG图像数据
    const backgroundImage = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAQMAAABmvDolAAAAA1BMVEWVpJ2TJdvlAAAAH0lEQVR42u3BAQ0AAADCIPunNsc3YAAAAAAAAAAAABwKDsAAAV0tqVQAAAAASUVORK5CYII=";
    const headImage = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAQMAAABmvDolAAAAA1BMVEWVpJ2TJdvlAAAAH0lEQVR42u3BAQ0AAADCIPunNsc3YAAAAAAAAAAAABwKDsAAAV0tqVQAAAAASUVORK5CYII=";
    const eyesImage = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAQMAAABmvDolAAAAA1BMVEWVpJ2TJdvlAAAAH0lEQVR42u3BAQ0AAADCIPunNsc3YAAAAAAAAAAAABwKDsAAAV0tqVQAAAAASUVORK5CYII=";
    const mouthImage = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAQMAAABmvDolAAAAA1BMVEWVpJ2TJdvlAAAAH0lEQVR42u3BAQ0AAADCIPunNsc3YAAAAAAAAAAAABwKDsAAAV0tqVQAAAAASUVORK5CYII=";
    const accessoryImage = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAQMAAABmvDolAAAAA1BMVEWVpJ2TJdvlAAAAH0lEQVR42u3BAQ0AAADCIPunNsc3YAAAAAAAAAAAABwKDsAAAV0tqVQAAAAASUVORK5CYII=";
    
    // 创建不同类型的组件模板
    const componentImages = [
      backgroundImage,
      headImage,
      eyesImage,
      mouthImage,
      accessoryImage
    ];
    
    const componentTypes = [0, 1, 2, 3, 4];
    const componentNames = ["Background 1", "HairStyle 1", "Eyes 1", "Mouth 1", "Accessory 1"];
    
    // 获取模板创建费用
    const templateCreationFee = await component.read.templateCreationFee();
    const mintPrice = parseEther("0.01");

    const creatorClient = await hre.viem.getContractAt(
      "AllNadsComponent",
      component.address,
      { client: { wallet: creator } }
    );
    
    // 创建模板并保存模板ID
    const templateIds = [];
    for (let i = 0; i < 10; i++) {
      const index = i % 5;
      const tx = await creatorClient.write.createTemplate([
        componentNames[index],
        100n,
        mintPrice,
        componentImages[index],
        componentTypes[index]
      ], {
        value: templateCreationFee
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      templateIds.push(BigInt(i + 1));
    }
    
    return {
      component,
      account,
      registry,
      renderer,
      allNads,
      owner,
      creator,
      buyer,
      publicClient,
      templateIds
    };
  }

  // 部署合约并铸造一个NFT的测试夹具
  async function deployAndMintNFTFixture() {
    // 首先部署基本合约
    const baseFixture = await deployAllNadsFixture();
    const { 
      allNads, 
      component, 
      owner, 
      buyer, 
      publicClient, 
      templateIds 
    } = baseFixture;
    
    // 使用buyer创建客户端
    const buyerClient = await hre.viem.getContractAt(
      "AllNads",
      allNads.address,
      { client: { wallet: buyer } }
    );
    
    // 使用owner创建组件合约客户端
    const allNadsOwnerClient = await hre.viem.getContractAt(
      "AllNads",
      allNads.address,
      { client: { wallet: owner } }
    );
    
    // 铸造一个NFT
    const avatarName = "Test Avatar";
    const mintTx = await buyerClient.write.mint([
      avatarName,
      templateIds[0],
      templateIds[1],
      templateIds[2],
      templateIds[3],
      templateIds[4]
    ], { value: parseEther("0.05") }); // 5 x 0.01 ETH
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });
    
    // 从事件中获取铸造的代币ID
    const mintEvents = await allNads.getEvents.AvatarMinted();
    
    const mintedTokenId = mintEvents[0].args.tokenId!;
    const componentTokens = [
      mintEvents[0].args.backgroundId!,
      mintEvents[0].args.hairstyleId!,
      mintEvents[0].args.eyesId!,
      mintEvents[0].args.mouthId!,
      mintEvents[0].args.accessoryId!
    ];
    
    return {
      ...baseFixture,
      mintedTokenId,
      componentTokens,
      allNadsOwnerClient,
      buyerClient
    };
  }

  // 类型定义
  type BaseContract = {
    address: string;
    read: Record<string, (...args: any[]) => Promise<any>>;
  };

  type BaseWallet = {
    account: {
      address: string;
    };
  };

  // 辅助函数：设置铸造费并获取总价格
  async function setupMintFeeAndGetPrice(
    allNads: { address: string; read: { mintFee: () => Promise<bigint> } }, 
    owner: { account: { address: string } }, 
    mintFee = 0n
  ) {
    // 设置 mintFee
    if (mintFee > 0n) {
      // 使用类型断言来处理复杂类型
      const getContractAt = hre.viem.getContractAt as unknown as (
        name: string, 
        address: string, 
        options: any
      ) => Promise<{ write: { setMintFee: (args: [bigint]) => Promise<`0x${string}`> } }>;
      
      const ownerClient = await getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: owner } }
      );
      
      await ownerClient.write.setMintFee([mintFee]);
    }
    
    // 获取设置后的 mintFee 值确认
    const currentMintFee = await allNads.read.mintFee();
    
    // 基础组件价格 (5个组件，每个0.01 ETH)
    const componentPrice = parseEther("0.05");
    // 计算总价格 (组件价格 + mintFee)
    const totalPrice = componentPrice + currentMintFee;
    
    return { componentPrice, totalPrice, currentMintFee };
  }

  describe("Deployment", function () {
    it("Should set the correct contract addresses", async function () {
      const { allNads, component, account, registry, renderer } = await loadFixture(deployAllNadsFixture);
      
      expect(await allNads.read.componentContract()).to.equal(getAddress(component.address));
      expect(await allNads.read.accountImplementation()).to.equal(getAddress(account.address));
      expect(await allNads.read.registry()).to.equal(getAddress(registry.address));
      expect(await allNads.read.rendererContract()).to.equal(getAddress(renderer.address));
    });
    
    it("Should have default mintFee of 0", async function () {
      const { allNads } = await loadFixture(deployAllNadsFixture);
      const mintFee = await allNads.read.mintFee();
      expect(mintFee).to.equal(0n);
    });
  });

  describe("Component Template Management", function () {
    it("Should create component templates", async function () {
      const { component, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 检查每个模板是否存在
      for (const templateId of templateIds) {
        const template = await component.read.getTemplate([templateId]);
        expect(template.name).to.not.equal(""); // 使用.name而不是[0]来访问
      }
    });

    it("Should allow owner to update template prices", async function () {
      const { component, templateIds, publicClient, creator } = await loadFixture(deployAllNadsFixture);
      
      const templateId = templateIds[0];
      const newPrice = parseEther("0.02");
      
      const creatorClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: creator } }
      );
      // 更新模板价格
      const tx = await creatorClient.write.updateTemplatePrice([templateId, newPrice]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查价格是否更新
      const template = await component.read.getTemplate([templateId]);
      expect(template.price).to.equal(newPrice);
    });
  });

  describe("MintFee Management", function () {
    it("Should allow owner to set mintFee", async function () {
      const { allNads, owner, publicClient } = await loadFixture(deployAllNadsFixture);
      
      const mintFee = parseEther("0.01");
      const ownerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: owner } }
      );
      
      const tx = await ownerClient.write.setMintFee([mintFee]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      const newMintFee = await allNads.read.mintFee();
      expect(newMintFee).to.equal(mintFee);
    });
    
    it("Should correctly calculate total price with mintFee", async function () {
      const { allNads, owner } = await loadFixture(deployAllNadsFixture);
      
      const mintFee = parseEther("0.01");
      const ownerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: owner } }
      );
      await ownerClient.write.setMintFee([mintFee]);
      
      const componentPrice = parseEther("0.05");
      const totalPrice = await allNads.read.getTotalPrice([componentPrice]);
      
      expect(totalPrice).to.equal(componentPrice + mintFee);
    });
  });

  describe("NFT Minting", function () {
    it("Should mint an NFT when paying the correct price", async function () {
      const { allNads, owner: contractOwner, creator, buyer, publicClient, templateIds, component } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee 并获取总价
      const mintFee = parseEther("0.01");
      const { componentPrice, totalPrice } = await setupMintFeeAndGetPrice(allNads, contractOwner, mintFee);
      
      // 使用buyer铸造NFT
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      const name = "Test Nads";
      const beforeMintBalanceOwner = await publicClient.getBalance({ address: contractOwner.account.address });
      const beforeMintBalanceCreator = await publicClient.getBalance({ address: creator.account.address });
      
      // 准备铸造参数
      const creatorRoyalty = await component.read.creatorRoyaltyPercentage();
      
      // 铸造NFT - 使用正确的函数名和参数，包含 mintFee
      const tx = await buyerClient.write.mint([
        name, 
        templateIds[0], // 背景
        templateIds[1], // 发型
        templateIds[2], // 眼睛
        templateIds[3], // 嘴巴
        templateIds[4]  // 配饰
      ], { value: totalPrice });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查合约余额 - 应该有 mintFee
      const contractBalance = await publicClient.getBalance({ address: allNads.address });
      expect(contractBalance).to.equal(mintFee);
      
      // 检查余额增加 - 创建者和所有者分割组件价格
      const afterMintBalanceOwner = await publicClient.getBalance({ address: contractOwner.account.address });
      const afterMintBalanceCreator = await publicClient.getBalance({ address: creator.account.address });

      expect(afterMintBalanceOwner).to.equal(beforeMintBalanceOwner + componentPrice * (100n - creatorRoyalty) / 100n);
      expect(afterMintBalanceCreator).to.equal(beforeMintBalanceCreator + componentPrice * creatorRoyalty / 100n);
      
      // 检查NFT持有者
      const tokenId = 1n;
      const tokenOwner = await allNads.read.ownerOf([tokenId]);
      expect(tokenOwner).to.equal(getAddress(buyer.account.address));
    });

    it("Should revert when not paying enough", async function () {
      const { allNads, owner, buyer, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee 并获取总价
      const mintFee = parseEther("0.01");
      const { componentPrice, totalPrice } = await setupMintFeeAndGetPrice(allNads, owner, mintFee);
      
      // 使用buyer铸造NFT
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      const name = "Test Nads";
      
      // 使用低于所需的价格
      await expect(
        buyerClient.write.mint([
          name, 
          templateIds[0], // 背景
          templateIds[1], // 发型
          templateIds[2], // 眼睛
          templateIds[3], // 嘴巴
          templateIds[4]  // 配饰
        ], { value: componentPrice }) // 只付组件价格，不含 mintFee
      ).to.be.rejectedWith(/Incorrect payment/i);
    });
  });

  describe("Component Management", function () {
    it("Should allow minting components for a NAD", async function () {
      const { allNads, owner, buyer, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee 并获取总价
      const { totalPrice } = await setupMintFeeAndGetPrice(allNads, owner);
      
      // 使用buyer铸造NFT
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 先铸造NFT
      const tx1 = await buyerClient.write.mint([
        "Test Nads", 
        templateIds[0], // 背景
        templateIds[1], // 发型
        templateIds[2], // 眼睛
        templateIds[3], // 嘴巴
        templateIds[4]  // 配饰
      ], { value: totalPrice });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      const tokenId = 1n;
      
      // 检查组件ID为1的持有者是账户合约
      const accountAddr = await allNads.read.accountForToken([tokenId]);
      expect(accountAddr).to.not.equal(zeroAddress);
    });

    it("Should equip and unequip components", async function () {
      const { allNads, component, owner, buyer, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee 并获取总价
      const { totalPrice } = await setupMintFeeAndGetPrice(allNads, owner);
      
      // 先铸造NFT
      const tx1 = await allNads.write.mint([
        "Test Nads", 
        templateIds[0], // 背景
        templateIds[1], // 发型
        templateIds[2], // 眼睛
        templateIds[3], // 嘴巴
        templateIds[4]  // 配饰
      ], { value: totalPrice, account: buyer.account });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      const avatarTokenId = 1n;
      
      // 获取铸造的所有组件信息
      const avatarComponents = await allNads.read.getAvatarComponents([avatarTokenId]);
      for (const componentId of avatarComponents) {
        const isEquipped = await component.read.isEquipped([componentId]);
        expect(isEquipped).to.be.true;
      }

      // 获取头像的TBA (Token Bound Account)
      const tba = await allNads.read.accountForToken([avatarTokenId]);

      const tx2 = await component.write.mintComponent([
        templateIds[5],
        tba
      ], { value: parseEther("0.01"), account: buyer.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx2 });
      // 从交易收据中获取新组件的ID
      // 查找TemplateMinted事件来获取新铸造的组件ID
      const events = await publicClient.getContractEvents({
        address: component.address,
        abi: component.abi,
        eventName: 'TemplateMinted',
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber
      });
      
      // 从事件中提取tokenId
      const newComponentId = events[0].args.tokenId!;
      const oldComponentId = 1n;
      
      // 卸下组件
      const tx = await allNads.write.changeComponent([
        avatarTokenId, 
        newComponentId, 
        0  // 组件类型应该是数字，不是 BigInt
      ], { account: buyer.account });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查组件是否已卸下
      const tokenData = await allNads.read.getAvatar([avatarTokenId]);
      expect(tokenData.backgroundId).to.equal(newComponentId);
      const oldIsEquipped = await component.read.isEquipped([oldComponentId]);
      expect(oldIsEquipped).to.be.false;
      const newIsEquipped = await component.read.isEquipped([newComponentId]);
      expect(newIsEquipped).to.be.true;
    });
  });

  describe("Account Integration", function () {
    it("Should create an account for each minted NFT", async function () {
      const { allNads, owner, buyer, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee 并获取总价
      const { totalPrice } = await setupMintFeeAndGetPrice(allNads, owner);
      
      // 使用buyer铸造NFT
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 铸造NFT
      const tx = await buyerClient.write.mint([
        "Test Nads", 
        templateIds[0], // 背景
        templateIds[1], // 发型
        templateIds[2], // 眼睛
        templateIds[3], // 嘴巴
        templateIds[4]  // 配饰
      ], { value: totalPrice });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      const tokenId = 1n;
      
      // 获取账户地址
      const accountAddr = await allNads.read.accountForToken([tokenId]);
      
      // 验证账户地址不为0地址
      expect(accountAddr).to.not.equal(zeroAddress);
    });

    it("Should allow token owner to execute transactions through the account", async function () {
      const { allNads, owner, buyer, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee 并获取总价
      const { totalPrice } = await setupMintFeeAndGetPrice(allNads, owner);
      
      // 铸造NFT
      const tx1 = await allNads.write.mint([
        "Test Nads", 
        templateIds[0], // 背景
        templateIds[1], // 发型
        templateIds[2], // 眼睛
        templateIds[3], // 嘴巴
        templateIds[4]  // 配饰
      ], { value: totalPrice, account: buyer.account });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });

      const nftTokenId = 1n;
      
      // 获取 TBA 地址
      const accountAddr = await allNads.read.accountForToken([nftTokenId]);
      
      // 向账户发送一些ETH以便测试
      const sendEthTx = await buyer.sendTransaction({
        to: accountAddr,
        value: parseEther("0.1")
      });
      await publicClient.waitForTransactionReceipt({ hash: sendEthTx });

      const beforeAccountBalance = await publicClient.getBalance({ address: accountAddr });

      // 准备调用数据
      const target = getAddress(buyer.account.address); // 修改为 buyer 作为目标地址
      const value = parseEther("0.05");
      const callData = "0x";
      
      const buyerClient = await hre.viem.getContractAt(
        "AllNadsAccount",
        accountAddr,
        { client: { wallet: buyer } }
      );

      // 用户直接通过账户合约执行调用
      const executeCallTx = await buyerClient.write.executeCall([
        target,
        value,
        callData,
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: executeCallTx });
      
      // 检查余额是否减少
      const afterAccountBalance = await publicClient.getBalance({ address: accountAddr });
      expect(afterAccountBalance < beforeAccountBalance).to.be.true;
    });
  });

  describe("Token URI", function () {
    it("Should generate token URI with component data", async function () {
      const { allNads, owner, buyer, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee 并获取总价
      const { totalPrice } = await setupMintFeeAndGetPrice(allNads, owner);
      
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      const name = "Test Nads";
      const tx1 = await buyerClient.write.mint([
        name, 
        templateIds[0], // 背景
        templateIds[1], // 发型
        templateIds[2], // 眼睛
        templateIds[3], // 嘴巴
        templateIds[4]  // 配饰
      ], { value: totalPrice });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      const tokenId = 1n;
      
      // 获取tokenURI
      const tokenURI = await allNads.read.tokenURI([tokenId]);
      
      // tokenURI应该是一个非空字符串
      expect(tokenURI).to.be.a("string");
      expect(tokenURI.length).to.be.greaterThan(0);
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw funds", async function () {
      const { allNads, owner, buyer, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 设置 mintFee
      const mintFee = parseEther("0.01");
      const ownerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: owner } }
      );
      await ownerClient.write.setMintFee([mintFee]);
      
      // 获取设置后的 mintFee 值确认
      const currentMintFee = await allNads.read.mintFee();
      expect(currentMintFee).to.equal(mintFee);
      
      // 使用buyer铸造NFT
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 计算组件总价格
      const componentPrice = parseEther("0.05");
      // 计算总价格 (组件价格 + mintFee)
      const totalPrice = componentPrice + mintFee;
      
      // 铸造NFT - 支付组件价格 + mintFee
      const tx1 = await buyerClient.write.mint([
        "Test Nads", 
        templateIds[0], // 背景
        templateIds[1], // 发型
        templateIds[2], // 眼睛
        templateIds[3], // 嘴巴
        templateIds[4]  // 配饰
      ], { value: totalPrice });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      // 验证铸造交易成功
      const receipt = await publicClient.getTransactionReceipt({ hash: tx1 });
      expect(receipt.status).to.equal('success');
      
      // 获取合约余额，应该等于 mintFee
      const contractBalance = await publicClient.getBalance({ address: allNads.address });
      expect(contractBalance).to.equal(mintFee);
      
      // 记录owner初始余额
      const initialOwnerBalance = await publicClient.getBalance({ address: owner.account.address });
      
      // 使用owner提取资金
      const withdrawTx = await ownerClient.write.withdraw();
      const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
      
      // 检查合约余额为0
      const newContractBalance = await publicClient.getBalance({ address: allNads.address });
      expect(newContractBalance).to.equal(0n);
      
      // 获取owner最终余额
      const finalOwnerBalance = await publicClient.getBalance({ address: owner.account.address });
      
      // 计算gas消耗
      const gasUsed = withdrawReceipt.gasUsed * withdrawReceipt.effectiveGasPrice;
      
      // 验证owner余额变化 - owner应该收到了mintFee减去gas费用
      expect(finalOwnerBalance + gasUsed >= initialOwnerBalance + mintFee).to.be.true;
    });
  });

  describe("Multiple Component Changes", function () {
    it("Should change multiple components at once", async function () {
      const { 
        allNads, 
        component,
        owner,
        buyer, 
        publicClient, 
        templateIds,
        mintedTokenId 
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 获取token关联的账户地址
      const accountAddress = await allNads.read.accountForToken([mintedTokenId]);
      
      // 创建组件合约的owner客户端
      const componentOwnerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      // 创建5个新模板用于测试更改组件
      const newTemplateIds = [];
      const componentTypeNames = ["BACKGROUND", "HAIRSTYLE", "EYES", "MOUTH", "ACCESSORY"];
      
      for (let i = 0; i < 5; i++) {
        const tx = await componentOwnerClient.write.createTemplate([
          `New ${componentTypeNames[i]}`,
          100n,
          parseEther("0.01"),
          `New${componentTypeNames[i]}ImageData`,
          i
        ], { value: parseEther("0.01") });
        
        await publicClient.waitForTransactionReceipt({ hash: tx });
        newTemplateIds.push(BigInt(templateIds.length + 1 + i));
      }
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 为账户铸造新组件
      const newComponentIds = [];
      for (let i = 0; i < newTemplateIds.length; i++) {
        const tx = await component.write.mintComponent(
          [newTemplateIds[i], accountAddress],
          { account: owner.account, value: parseEther("0.01") }
        );
        
        await publicClient.waitForTransactionReceipt({ hash: tx });
        newComponentIds.push(BigInt(5 + i + 1)); // 原有5个组件+新组件
      }
      
      // 获取当前头像组件
      const originalComponents = await allNads.read.getAvatarComponents([mintedTokenId]);
      
      // 更改多个组件（仅更改部分组件）
      const tx = await buyerClient.write.changeComponents([
        mintedTokenId,
        newComponentIds[0], // 新背景
        0n,                 // 保持现有发型
        newComponentIds[2], // 新眼睛
        0n,                 // 保持现有嘴巴
        newComponentIds[4]  // 新配饰
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 获取更新后的组件
      const updatedComponents = await allNads.read.getAvatarComponents([mintedTokenId]);
      
      // 验证更改的组件已更新
      expect(updatedComponents[0]).to.equal(newComponentIds[0]); // 背景已更改
      expect(updatedComponents[1]).to.equal(originalComponents[1]); // 发型未变
      expect(updatedComponents[2]).to.equal(newComponentIds[2]); // 眼睛已更改
      expect(updatedComponents[3]).to.equal(originalComponents[3]); // 嘴巴未变
      expect(updatedComponents[4]).to.equal(newComponentIds[4]); // 配饰已更改
      
      // 确认原组件已解锁
      expect(await component.read.isEquipped([originalComponents[0]])).to.be.false;
      expect(await component.read.isEquipped([originalComponents[2]])).to.be.false;
      expect(await component.read.isEquipped([originalComponents[4]])).to.be.false;
      
      // 确认新组件已锁定
      expect(await component.read.isEquipped([newComponentIds[0]])).to.be.true;
      expect(await component.read.isEquipped([newComponentIds[2]])).to.be.true;
      expect(await component.read.isEquipped([newComponentIds[4]])).to.be.true;
    });
    
    it("Should keep existing components when passing zero IDs", async function () {
      const { 
        allNads, 
        buyer,
        publicClient, 
        mintedTokenId
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 获取原始组件
      const originalComponents = await allNads.read.getAvatarComponents([mintedTokenId]);
      
      // 调用changeComponents但传入所有0值
      const tx = await buyerClient.write.changeComponents([
        mintedTokenId,
        0n, 0n, 0n, 0n, 0n
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 获取更新后的组件
      const updatedComponents = await allNads.read.getAvatarComponents([mintedTokenId]);
      
      // 验证所有组件保持不变
      for (let i = 0; i < originalComponents.length; i++) {
        expect(updatedComponents[i]).to.equal(originalComponents[i]);
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should fail to query non-existent avatar", async function () {
      const { allNads } = await loadFixture(deployAllNadsFixture);
      
      // 尝试获取不存在的头像
      const nonExistentTokenId = 999n;
      await expect(allNads.read.getAvatar([nonExistentTokenId]))
        .to.be.rejectedWith(/Token does not exist/);
    });
    
    it("Should fail to get components for non-existent avatar", async function () {
      const { allNads } = await loadFixture(deployAllNadsFixture);
      
      // 尝试获取不存在的头像的组件
      const nonExistentTokenId = 999n;
      await expect(allNads.read.getAvatarComponents([nonExistentTokenId]))
        .to.be.rejectedWith(/Token does not exist/);
    });
    
    it("Should revert when name is too long", async function () {
      const { 
        allNads, 
        buyer, 
        publicClient, 
        mintedTokenId
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 创建一个超过50个字符的名称
      const longName = "a".repeat(51);
      
      // 尝试更新名称
      await expect(buyerClient.write.updateName([mintedTokenId, longName]))
        .to.be.rejectedWith(/Name too long/);
    });
  });

  describe("Transfer and Authorization", function () {
    it("Should allow transfer of NFT to another address", async function () {
      const { 
        allNads, 
        buyer,
        creator,
        publicClient, 
        mintedTokenId
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 获取地址
      const buyerAddress = getAddress(buyer.account.address);
      const creatorAddress = getAddress(creator.account.address);
      
      // 确认buyer是NFT的当前所有者
      expect(await allNads.read.ownerOf([mintedTokenId])).to.equal(buyerAddress);
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 转移NFT到creator
      const tx = await buyerClient.write.transferFrom([
        buyerAddress,
        creatorAddress,
        mintedTokenId
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 验证所有权已经转移
      expect(await allNads.read.ownerOf([mintedTokenId])).to.equal(creatorAddress);
    });
    
    it("Should allow approved address to change components", async function () {
      const { 
        allNads, 
        component,
        buyer,
        creator,
        owner,
        publicClient, 
        mintedTokenId,
        templateIds
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 获取地址
      const buyerAddress = getAddress(buyer.account.address);
      const creatorAddress = getAddress(creator.account.address);
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // buyer批准creator操作NFT
      const approveTx = await buyerClient.write.approve([
        creatorAddress,
        mintedTokenId
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      
      // 获取token关联的账户地址
      const accountAddress = await allNads.read.accountForToken([mintedTokenId]);
      
      // 创建一个新的组件模板
      const componentOwnerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      const createTemplateTx = await componentOwnerClient.write.createTemplate([
        "New Background",
        100n,
        parseEther("0.01"),
        "NewBackgroundImageData",
        0 // BACKGROUND
      ], { value: parseEther("0.01") });
      
      await publicClient.waitForTransactionReceipt({ hash: createTemplateTx });
      const newTemplateId = BigInt(templateIds.length + 1);
      
      // 为账户铸造新组件
      const mintTx = await component.write.mintComponent(
        [newTemplateId, accountAddress],
        { account: owner.account, value: parseEther("0.01") }
      );
      
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      const newComponentId = 6n; // 原有5个组件+1
      
      // 获取原始组件
      const originalComponents = await allNads.read.getAvatarComponents([mintedTokenId]);
      
      // 使用creator创建客户端
      const creatorClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: creator } }
      );
      
      // creator尝试更改组件
      const changeTx = await creatorClient.write.changeComponent([
        mintedTokenId,
        newComponentId,
        0 // BACKGROUND
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: changeTx });
      
      // 获取更新后的组件
      const updatedComponents = await allNads.read.getAvatarComponents([mintedTokenId]);
      
      // 验证组件已更改
      expect(updatedComponents[0]).to.equal(newComponentId);
      expect(updatedComponents[0]).to.not.equal(originalComponents[0]);
    });
  });

  describe("Utility Functions", function () {
    it("Should validate components correctly", async function () {
      const { 
        allNads, 
        templateIds
      } = await loadFixture(deployAllNadsFixture);
      
      // 使用有效的组件模板ID进行验证
      const isValid = await allNads.read.validateComponents([
        templateIds[0], // background
        templateIds[1], // hairstyle
        templateIds[2], // eyes
        templateIds[3], // mouth
        templateIds[4]  // accessory
      ]);
      
      expect(isValid).to.be.true;
      
      // 类型不匹配的验证（使用错误的组件类型）
      const isInvalidType = await allNads.read.validateComponents([
        templateIds[1], // hairstyle用作background
        templateIds[0], // background用作hairstyle
        templateIds[2], // eyes
        templateIds[3], // mouth
        templateIds[4]  // accessory
      ]);
      
      expect(isInvalidType).to.be.false;
    });
    
    it("Should calculate total cost correctly", async function () {
      const { 
        allNads, 
        templateIds,
        owner,
        publicClient
      } = await loadFixture(deployAllNadsFixture);
      
      // 计算没有mintFee时的总成本
      const baseCost = await allNads.read.calculateTotalCost([
        templateIds[0],
        templateIds[1],
        templateIds[2],
        templateIds[3],
        templateIds[4]
      ]);
      
      const expectedBaseCost = parseEther("0.05"); // 5 components * 0.01 ETH
      expect(baseCost).to.equal(expectedBaseCost);
      
      // 总价格应该等于组件成本+mintFee
      const totalPrice = await allNads.read.getTotalPrice([baseCost]);
      expect(totalPrice).to.equal(baseCost); // mintFee默认为0
      
      // 设置mintFee
      const ownerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: owner } }
      );
      
      const mintFee = parseEther("0.01");
      const setFeeTx = await ownerClient.write.setMintFee([mintFee]);
      await publicClient.waitForTransactionReceipt({ hash: setFeeTx });
      
      // 重新计算总价格
      const newTotalPrice = await allNads.read.getTotalPrice([baseCost]);
      expect(newTotalPrice).to.equal(baseCost + mintFee);
    });
    
    it("Should get avatar components correctly", async function () {
      const { 
        allNads, 
        mintedTokenId,
        componentTokens
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 获取头像组件
      const components = await allNads.read.getAvatarComponents([mintedTokenId]);
      
      // 验证返回的组件ID与铸造时使用的组件ID匹配
      expect(components.length).to.equal(5);
      
      for (let i = 0; i < components.length; i++) {
        expect(components[i]).to.equal(componentTokens[i]);
      }
    });
  });

  describe("Complete Avatar Creation and URI", function () {
    it("Should create a complete avatar and return correct tokenURI", async function () {
      const { 
        allNads, 
        component,
        owner,
        buyer,
        renderer,
        publicClient, 
        templateIds
      } = await loadFixture(deployAllNadsFixture);
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: buyer } }
      );
      
      // 铸造一个新头像
      const avatarName = "Complete Test Avatar";
      const mintTx = await buyerClient.write.mint([
        avatarName,
        templateIds[0],
        templateIds[1],
        templateIds[2],
        templateIds[3],
        templateIds[4]
      ], { value: parseEther("0.05") }); // 5 x 0.01 ETH
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 从事件中获取铸造的代币ID
      const mintEvents = await allNads.getEvents.AvatarMinted();
      
      expect(mintEvents.length).to.be.greaterThan(0);
      const tokenId = mintEvents[0].args.tokenId;
      
      // 获取头像详情
      const avatar = await allNads.read.getAvatar([tokenId]);
      expect(avatar.name).to.equal(avatarName);
      
      // 获取URI
      const tokenURI = await allNads.read.tokenURI([tokenId]);
      
      // URI应该包含JSON
      expect(tokenURI).to.include("data:application/json");
      
      // URI应该包含头像名称
      expect(tokenURI).to.include(avatarName);
      
      // URI应该包含SVG图像
      expect(tokenURI).to.include("image/svg+xml");
      
      // URI应该包含属性
      expect(tokenURI).to.include("attributes");
      
      // 创建一个新模板
      const componentOwnerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      const createTemplateTx = await componentOwnerClient.write.createTemplate([
        "Updated Eyes",
        100n,
        parseEther("0.01"),
        "UpdatedEyesImageData",
        2 // EYES
      ], { value: parseEther("0.01") });
      
      await publicClient.waitForTransactionReceipt({ hash: createTemplateTx });
      const newTemplateId = BigInt(templateIds.length + 1);
      
      // 获取token关联的账户地址
      const accountAddress = await allNads.read.accountForToken([tokenId]);
      
      // 为账户铸造新组件
      const mintCompTx = await component.write.mintComponent(
        [newTemplateId, accountAddress],
        { account: owner.account, value: parseEther("0.01") }
      );
      
      await publicClient.waitForTransactionReceipt({ hash: mintCompTx });
      const newComponentId = BigInt(5 + 1); // 5个原始组件+1个新组件
      
      // 更改组件
      const changeTx = await buyerClient.write.changeComponent([
        tokenId,
        newComponentId,
        2 // EYES
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: changeTx });
      
      // 获取更新后的URI
      const updatedTokenURI = await allNads.read.tokenURI([tokenId]);
      
      // URI应该包含更新后的组件ID
      expect(updatedTokenURI).to.include(`"trait_type":"Eyes","value":"${newComponentId.toString()}"`);
    });
  });

  describe("Advanced Account Integration", function () {
    it("Should allow token bound account to receive and send ETH", async function () {
      const { 
        allNads, 
        buyer,
        publicClient, 
        mintedTokenId
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 获取token关联的账户地址
      const accountAddress = await allNads.read.accountForToken([mintedTokenId]);
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNadsAccount",
        accountAddress,
        { client: { wallet: buyer } }
      );
      
      // 发送ETH到账户
      const sendAmount = parseEther("0.1");
      const sendTx = await buyer.sendTransaction({
        to: accountAddress,
        value: sendAmount
      });
      
      await publicClient.waitForTransactionReceipt({ hash: sendTx });
      
      // 检查账户余额
      const balance = await publicClient.getBalance({ address: accountAddress });
      expect(balance).to.equal(sendAmount);
      
      // 从账户发送ETH
      const sendBackAmount = parseEther("0.05");
      const sendBackTx = await buyerClient.write.send([
        buyer.account.address,
        sendBackAmount
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: sendBackTx });
      
      // 检查更新后的余额
      const updatedBalance = await publicClient.getBalance({ address: accountAddress });
      expect(Number(updatedBalance)).to.be.closeTo(Number(sendAmount - sendBackAmount), Number(parseEther("0.001"))); // 允许一点gas误差
    });
    
    it("Should verify account nonce increments after transactions", async function () {
      const { 
        allNads, 
        buyer,
        publicClient, 
        mintedTokenId
      } = await loadFixture(deployAndMintNFTFixture);
      
      // 获取token关联的账户地址
      const accountAddress = await allNads.read.accountForToken([mintedTokenId]);
      
      // 使用buyer创建客户端
      const buyerClient = await hre.viem.getContractAt(
        "AllNadsAccount",
        accountAddress,
        { client: { wallet: buyer } }
      );
      
      // 发送ETH到账户
      const sendTx = await buyer.sendTransaction({
        to: accountAddress,
        value: parseEther("0.1")
      });
      
      await publicClient.waitForTransactionReceipt({ hash: sendTx });
      
      // 获取初始nonce
      const initialNonce = await buyerClient.read.nonce();
      expect(initialNonce).to.equal(0n);
      
      // 执行一个交易
      const executeTx = await buyerClient.write.send([
        buyer.account.address,
        parseEther("0.01")
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: executeTx });
      
      // 检查nonce是否增加
      const newNonce = await buyerClient.read.nonce();
      expect(newNonce).to.equal(1n);
      
      // 执行另一个交易
      const executeTx2 = await buyerClient.write.send([
        buyer.account.address,
        parseEther("0.01")
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: executeTx2 });
      
      // 再次检查nonce
      const finalNonce = await buyerClient.read.nonce();
      expect(finalNonce).to.equal(2n);
    });
  });
}); 