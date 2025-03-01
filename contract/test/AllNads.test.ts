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
      console.log("Token Bound Account address:", tba);
      

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
      console.log("newComponentId", newComponentId);
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
      console.log("receipt", receipt.status);
      expect(receipt.status).to.equal('success');
      
      // 获取合约余额，应该等于 mintFee
      const contractBalance = await publicClient.getBalance({ address: allNads.address });
      console.log("contractBalance", contractBalance);
      expect(contractBalance).to.equal(mintFee);
      
      // 记录owner初始余额
      const initialOwnerBalance = await publicClient.getBalance({ address: owner.account.address });
      console.log("initialOwnerBalance", initialOwnerBalance);
      
      // 使用owner提取资金
      const withdrawTx = await ownerClient.write.withdraw();
      const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
      
      // 检查合约余额为0
      const newContractBalance = await publicClient.getBalance({ address: allNads.address });
      expect(newContractBalance).to.equal(0n);
      
      // 获取owner最终余额
      const finalOwnerBalance = await publicClient.getBalance({ address: owner.account.address });
      console.log("finalOwnerBalance", finalOwnerBalance);
      
      // 计算gas消耗
      const gasUsed = withdrawReceipt.gasUsed * withdrawReceipt.effectiveGasPrice;
      
      // 验证owner余额变化 - owner应该收到了mintFee减去gas费用
      expect(finalOwnerBalance + gasUsed >= initialOwnerBalance + mintFee).to.be.true;
    });
  });
}); 