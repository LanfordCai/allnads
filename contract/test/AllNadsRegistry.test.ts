import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, encodeFunctionData } from "viem";

describe("AllNadsRegistry", function () {
  // 部署注册表合约的测试夹具
  async function deployRegistryFixture() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    
    // 部署注册表合约
    const registry = await hre.viem.deployContract("AllNadsRegistry", []);
    
    // 部署一个简单的账户实现合约用于测试
    const accountImpl = await hre.viem.deployContract("AllNadsAccount", []);
    
    // 部署一个测试NFT合约
    const testNFT = await hre.viem.deployContract("AllNads", [
      "TestNFT",
      "TNFT",
      registry.address,
      accountImpl.address,
      "0x0000000000000000000000000000000000000001" // 假的组件合约地址
    ]);
    
    // 测试数据
    const chainId = 31337n; // Hardhat默认链ID
    const tokenId = 1n;
    const salt = 0n;
    
    const publicClient = await hre.viem.getPublicClient();
    
    return {
      registry,
      accountImpl,
      testNFT,
      owner,
      user1,
      user2,
      chainId,
      tokenId,
      salt,
      publicClient
    };
  }

  describe("Account Creation", function () {
    it("Should create a new account correctly", async function () {
      const { 
        registry, 
        accountImpl, 
        testNFT, 
        owner,
        chainId, 
        tokenId, 
        salt, 
        publicClient 
      } = await loadFixture(deployRegistryFixture);
      
      // 创建一个registry客户端用于写入操作
      const registryClient = await hre.viem.getContractAt(
        "AllNadsRegistry",
        registry.address,
        { client: { wallet: owner } }
      );
      
      // 创建账户
      const createTx = await registryClient.write.createAccount([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt,
        "0x" // 空初始化数据
      ]);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
      
      // 从事件中获取创建的账户地址
      const events = await registry.getEvents.AccountCreated({
        blockHash: receipt.blockHash
      });
      
      // 验证事件已触发并包含正确的参数
      expect(events.length).to.be.greaterThan(0);
      expect(getAddress(events[0].args.implementation!)).to.equal(getAddress(accountImpl.address));
      expect(events[0].args.chainId).to.equal(chainId);
      expect(getAddress(events[0].args.tokenContract!)).to.equal(getAddress(testNFT.address));
      expect(events[0].args.tokenId).to.equal(tokenId);
      expect(events[0].args.salt).to.equal(salt);
      
      // 验证返回的账户地址不为空
      expect(events[0].args.account).to.not.equal("0x0000000000000000000000000000000000000000");
    });

    it("Should return the same account address from getAccount and createAccount", async function () {
      const { 
        registry, 
        accountImpl, 
        testNFT, 
        owner,
        chainId, 
        tokenId, 
        salt, 
        publicClient 
      } = await loadFixture(deployRegistryFixture);
      
      // 创建一个registry客户端用于写入操作
      const registryClient = await hre.viem.getContractAt(
        "AllNadsRegistry",
        registry.address,
        { client: { wallet: owner } }
      );
      
      // 获取预计的账户地址
      const expectedAccount = await registry.read.account([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt
      ]);
      
      // 创建账户
      const createTx = await registryClient.write.createAccount([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt,
        "0x" // 空初始化数据
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: createTx });
      
      // 再次使用getAccount检查地址
      const accountAddress = await registry.read.account([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt
      ]);
      
      expect(accountAddress).to.equal(expectedAccount);
    });
  });

  describe("Account Creation with Init Data", function () {
    it("Should initialize account with init data", async function () {
      const { 
        registry, 
        accountImpl, 
        testNFT, 
        owner,
        chainId, 
        tokenId, 
        salt, 
        publicClient 
      } = await loadFixture(deployRegistryFixture);
      
      // 创建一个registry客户端用于写入操作
      const registryClient = await hre.viem.getContractAt(
        "AllNadsRegistry",
        registry.address,
        { client: { wallet: owner } }
      );
      
      // 创建初始化数据 - 例如调用一个简单的函数
      const initData = encodeFunctionData({
        abi: [{
          type: 'function',
          name: 'nonce',
          inputs: [],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view'
        }],
        functionName: 'nonce',
        args: []
      });
      
      // 创建账户
      const createTx = await registryClient.write.createAccount([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt,
        initData
      ]);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createTx });
      
      // 检查交易是否成功
      expect(receipt.status).to.equal('success');
    });
  });

  describe("Multiple Account Creation", function () {
    it("Should create multiple accounts for the same token with different salts", async function () {
      const { 
        registry, 
        accountImpl, 
        testNFT, 
        owner,
        chainId, 
        tokenId, 
        publicClient 
      } = await loadFixture(deployRegistryFixture);
      
      // 创建一个registry客户端用于写入操作
      const registryClient = await hre.viem.getContractAt(
        "AllNadsRegistry",
        registry.address,
        { client: { wallet: owner } }
      );
      
      // 创建两个不同salt的账户
      const salt1 = 1n;
      const salt2 = 2n;
      
      // 获取预期地址
      const expectedAccount1 = await registry.read.account([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt1
      ]);
      
      const expectedAccount2 = await registry.read.account([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt2
      ]);
      
      // 确保地址不同
      expect(expectedAccount1).to.not.equal(expectedAccount2);
      
      // 创建第一个账户
      const createTx1 = await registryClient.write.createAccount([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt1,
        "0x"
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: createTx1 });
      
      // 创建第二个账户
      const createTx2 = await registryClient.write.createAccount([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt2,
        "0x"
      ]);
      
      await publicClient.waitForTransactionReceipt({ hash: createTx2 });
      
      // 获取两个账户地址
      const account1 = await registry.read.account([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt1
      ]);
      
      const account2 = await registry.read.account([
        accountImpl.address,
        chainId,
        testNFT.address,
        tokenId,
        salt2
      ]);
      
      expect(account1).to.equal(expectedAccount1);
      expect(account2).to.equal(expectedAccount2);
    });
  });
}); 