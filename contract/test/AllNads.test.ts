import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther, zeroAddress } from "viem";
import { deployPNGHeaderLib } from "./helpers/deployLibraries";

describe("AllNads", function () {
  // 部署所有合约的测试夹具
  async function deployAllNadsFixture() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    
    // 先部署 PNGHeaderLib 库
    const pngHeaderLibFactory = await deployPNGHeaderLib();
    
    // 部署组件合约，链接库
    const componentFactory = await hre.viem.deployContract("AllNadsComponent", [], {
      libraries: {
        "contracts/lib/PNGHeaderLib.sol:PNGHeaderLib": pngHeaderLibFactory.address
      }
    });
    
    const component = await hre.viem.getContractAt(
      "AllNadsComponent",
      componentFactory.address
    );
    
    // 部署账户实现合约
    const accountFactory = await hre.viem.deployContract("AllNadsAccount", []);
    
    const account = await hre.viem.getContractAt(
      "AllNadsAccount",
      accountFactory.address
    );
    
    // 部署注册表合约
    const registryFactory = await hre.viem.deployContract("AllNadsRegistry", []);
    
    const registry = await hre.viem.getContractAt(
      "AllNadsRegistry",
      registryFactory.address
    );
    
    // 部署渲染器合约
    const rendererFactory = await hre.viem.deployContract("AllNadsRenderer", [
      component.address,
      "DefaultBodyData"
    ]);
    
    const renderer = await hre.viem.getContractAt(
      "AllNadsRenderer",
      rendererFactory.address
    );
    
    // 部署主合约
    const allNadsFactory = await hre.viem.deployContract("AllNads", [
      component.address,
      account.address,
      registry.address,
      renderer.address,
      parseEther("0.05") // 铸造价格
    ]);
    
    const allNads = await hre.viem.getContractAt(
      "AllNads",
      allNadsFactory.address
    );
    
    // 公共客户端用于事务处理
    const publicClient = await hre.viem.getPublicClient();
    
    // 设置组件合约owner为allNads合约
    const componentOwnerClient = await hre.viem.getContractAt(
      "AllNadsComponent",
      component.address,
      { client: { wallet: owner } }
    );
    
    const transferOwnershipTx = await componentOwnerClient.write.transferOwnership([allNads.address]);
    await publicClient.waitForTransactionReceipt({ hash: transferOwnershipTx });
    
    // 创建组件模板
    const allNadsOwnerClient = await hre.viem.getContractAt(
      "AllNads",
      allNads.address,
      { client: { wallet: owner } }
    );
    
    // 创建不同类型的组件模板
    const templates = [
      {
        name: "Background 1",
        componentType: 0, // BACKGROUND
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "BackgroundImageData",
        isActive: true
      },
      {
        name: "Head 1",
        componentType: 1, // HAIRSTYLE/HEAD
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "HeadImageData",
        isActive: true
      },
      {
        name: "Eyes 1",
        componentType: 2, // EYES
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "EyesImageData",
        isActive: true
      },
      {
        name: "Mouth 1",
        componentType: 3, // MOUTH
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "MouthImageData",
        isActive: true
      },
      {
        name: "Accessory 1",
        componentType: 4, // ACCESSORY
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "AccessoryImageData",
        isActive: true
      }
    ];
    
    // 创建模板并保存模板ID
    const templateIds = [];
    for (const template of templates) {
      const tx = await allNadsOwnerClient.write.createComponentTemplate([
        template.name,
        template.componentType,
        template.maxSupply,
        template.price,
        template.imageData,
        template.isActive
      ]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      templateIds.push(BigInt(templateIds.length + 1));
    }
    
    return {
      component,
      account,
      registry,
      renderer,
      allNads,
      owner,
      user1,
      user2,
      publicClient,
      templateIds,
      allNadsOwnerClient,
      templates
    };
  }

  describe("Deployment", function () {
    it("Should set the correct contract addresses", async function () {
      const { allNads, component, account, registry, renderer } = await loadFixture(deployAllNadsFixture);
      
      expect(await allNads.read.componentContract()).to.equal(component.address);
      expect(await allNads.read.accountImplementation()).to.equal(account.address);
      expect(await allNads.read.registry()).to.equal(registry.address);
      expect(await allNads.read.renderer()).to.equal(renderer.address);
    });

    it("Should set the correct minting price", async function () {
      const { allNads } = await loadFixture(deployAllNadsFixture);
      
      expect(await allNads.read.mintPrice()).to.equal(parseEther("0.05"));
    });
  });

  describe("Component Template Management", function () {
    it("Should create component templates", async function () {
      const { allNads, component, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 检查模板数量
      const templateCount = await component.read.getTemplateCount();
      expect(templateCount).to.equal(BigInt(5));
      
      // 检查每个模板是否存在
      for (const templateId of templateIds) {
        const template = await component.read.templates([templateId]);
        expect(template[0]).to.not.equal(""); // 名称不为空
      }
    });

    it("Should allow owner to update template prices", async function () {
      const { allNads, component, templateIds, allNadsOwnerClient, publicClient } = await loadFixture(deployAllNadsFixture);
      
      const templateId = templateIds[0];
      const newPrice = parseEther("0.02");
      
      // 更新模板价格
      const tx = await allNadsOwnerClient.write.updateComponentTemplatePrice([templateId, newPrice]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查价格是否更新
      const template = await component.read.templates([templateId]);
      expect(template[3]).to.equal(newPrice);
    });
  });

  describe("NFT Minting", function () {
    it("Should mint an NFT when paying the correct price", async function () {
      const { allNads, user1, publicClient } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      const name = "Test Nads";
      const beforeMintBalance = await publicClient.getBalance({ address: allNads.address });
      
      // 铸造NFT
      const tx = await user1Client.write.mintNad([name], { value: parseEther("0.05") });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查余额增加
      const afterMintBalance = await publicClient.getBalance({ address: allNads.address });
      expect(afterMintBalance).to.equal(beforeMintBalance + parseEther("0.05"));
      
      // 检查NFT持有者
      const tokenId = 1n;
      const owner = await allNads.read.ownerOf([tokenId]);
      expect(owner).to.equal(getAddress(user1.account.address));
    });

    it("Should revert when not paying enough", async function () {
      const { allNads, user1 } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      const name = "Test Nads";
      
      // 使用低于所需的价格
      await expect(
        user1Client.write.mintNad([name], { value: parseEther("0.04") })
      ).to.be.rejectedWith(/insufficient payment/i);
    });
  });

  describe("Component Management", function () {
    it("Should allow minting components for a NAD", async function () {
      const { allNads, user1, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      // 先铸造NFT
      const tx1 = await user1Client.write.mintNad(["Test Nads"], { value: parseEther("0.05") });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      const tokenId = 1n;
      const templateId = templateIds[0]; // 背景模板
      
      // 为NFT铸造组件
      const tx2 = await user1Client.write.mintComponentForNad(
        [tokenId, templateId],
        { value: parseEther("0.01") }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx2 });
      
      // 检查组件是否被铸造并分配给了账户合约
      const accountAddr = await allNads.read.getAccountAddress([tokenId]);
      
      // 获取组件合约
      const component = await hre.viem.getContractAt(
        "AllNadsComponent",
        await allNads.read.componentContract()
      );
      
      // 检查组件ID为1的持有者是账户合约
      const componentId = 1n;
      const componentOwner = await component.read.ownerOf([componentId]);
      expect(componentOwner).to.equal(accountAddr);
    });

    it("Should equip and unequip components", async function () {
      const { allNads, user1, publicClient, templateIds, component } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      // 先铸造NFT
      const tx1 = await user1Client.write.mintNad(["Test Nads"], { value: parseEther("0.05") });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      const tokenId = 1n;
      
      // 为NFT铸造所有类型的组件
      const componentIds = [];
      for (const templateId of templateIds) {
        const tx = await user1Client.write.mintComponentForNad(
          [tokenId, templateId],
          { value: parseEther("0.01") }
        );
        await publicClient.waitForTransactionReceipt({ hash: tx });
        componentIds.push(BigInt(componentIds.length + 1));
      }
      
      // 装备背景组件
      const backgroundComponentId = componentIds[0];
      let tx = await user1Client.write.equipComponent([tokenId, 0, backgroundComponentId]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查是否装备了组件
      let tokenData = await allNads.read.tokenData([tokenId]);
      expect(tokenData.backgroundId).to.equal(backgroundComponentId);
      
      // 检查组件状态是否更新为装备中
      let isEquipped = await component.read.isEquipped([backgroundComponentId]);
      expect(isEquipped).to.be.true;
      
      // 卸下组件
      tx = await user1Client.write.unequipComponent([tokenId, 0]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查组件是否已卸下
      tokenData = await allNads.read.tokenData([tokenId]);
      expect(tokenData.backgroundId).to.equal(0n);
      
      // 检查组件状态是否更新为未装备
      isEquipped = await component.read.isEquipped([backgroundComponentId]);
      expect(isEquipped).to.be.false;
    });
  });

  describe("Account Integration", function () {
    it("Should create an account for each minted NFT", async function () {
      const { allNads, user1, publicClient } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造NFT
      const tx = await user1Client.write.mintNad(["Test Nads"], { value: parseEther("0.05") });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      const tokenId = 1n;
      
      // 获取账户地址
      const accountAddr = await allNads.read.getAccountAddress([tokenId]);
      
      // 验证账户地址不为0地址
      expect(accountAddr).to.not.equal(zeroAddress);
      
      // 验证账户有合约代码
      const code = await publicClient.getBytecode({ address: accountAddr });
      expect(code).to.not.be.null;
      expect(code).to.not.equal("0x");
    });

    it("Should allow token owner to execute transactions through the account", async function () {
      const { allNads, user1, publicClient } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造NFT
      const tx1 = await user1Client.write.mintNad(["Test Nads"], { value: parseEther("0.05") });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      const tokenId = 1n;
      
      // 获取账户地址
      const accountAddr = await allNads.read.getAccountAddress([tokenId]);
      
      // 向账户发送一些ETH以便测试
      const sendEthTx = await user1.sendTransaction({
        to: accountAddr,
        value: parseEther("0.1")
      });
      await publicClient.waitForTransactionReceipt({ hash: sendEthTx });
      
      // 获取账户合约
      const accountContract = await hre.viem.getContractAt(
        "AllNadsAccount",
        accountAddr
      );
      
      // 准备从账户发送ETH的交易数据
      const target = getAddress(user1.account.address);
      const value = parseEther("0.01");
      const callData = "0x"; // 空调用数据
      
      // 执行调用
      const tx2 = await user1Client.write.executeCall([tokenId, target, value, callData]);
      await publicClient.waitForTransactionReceipt({ hash: tx2 });
      
      // 检查余额是否减少
      const accountBalance = await publicClient.getBalance({ address: accountAddr });
      expect(accountBalance).to.be.lessThan(parseEther("0.1"));
    });
  });

  describe("Token URI", function () {
    it("Should generate token URI with component data", async function () {
      const { allNads, user1, publicClient, templateIds } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造NFT
      const name = "Test Nads";
      const tx1 = await user1Client.write.mintNad([name], { value: parseEther("0.05") });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      const tokenId = 1n;
      
      // 为NFT铸造所有类型的组件并装备
      const componentIds = [];
      for (let i = 0; i < templateIds.length; i++) {
        const templateId = templateIds[i];
        const tx = await user1Client.write.mintComponentForNad(
          [tokenId, templateId],
          { value: parseEther("0.01") }
        );
        await publicClient.waitForTransactionReceipt({ hash: tx });
        componentIds.push(BigInt(componentIds.length + 1));
        
        // 装备组件
        const equipTx = await user1Client.write.equipComponent([tokenId, BigInt(i), componentIds[i]]);
        await publicClient.waitForTransactionReceipt({ hash: equipTx });
      }
      
      // 获取令牌URI
      const tokenURI = await allNads.read.tokenURI([tokenId]);
      
      // 验证URI内容
      expect(tokenURI).to.include("data:application/json");
      expect(tokenURI).to.include(name);
      expect(tokenURI).to.include("image/svg+xml");
      
      // 验证包含每个装备的组件数据
      for (const componentId of componentIds) {
        expect(tokenURI).to.include(`"value":"${componentId.toString()}"`);
      }
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw funds", async function () {
      const { allNads, owner, user1, publicClient } = await loadFixture(deployAllNadsFixture);
      
      // 使用user1铸造NFT
      const user1Client = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造NFT
      const tx1 = await user1Client.write.mintNad(["Test Nads"], { value: parseEther("0.05") });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      
      // 获取合约余额
      const contractBalance = await publicClient.getBalance({ address: allNads.address });
      
      // 获取owner的初始余额
      const initialOwnerBalance = await publicClient.getBalance({ address: owner.account.address });
      
      // 取款
      const allNadsOwnerClient = await hre.viem.getContractAt(
        "AllNads",
        allNads.address,
        { client: { wallet: owner } }
      );
      
      const tx2 = await allNadsOwnerClient.write.withdraw();
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx2 });
      
      // 计算gas成本
      const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
      
      // 获取owner的最终余额
      const finalOwnerBalance = await publicClient.getBalance({ address: owner.account.address });
      
      // 验证合约余额是否已清空
      const newContractBalance = await publicClient.getBalance({ address: allNads.address });
      expect(newContractBalance).to.equal(0n);
      
      // 验证owner余额是否增加（考虑gas费用）
      expect(finalOwnerBalance).to.be.greaterThan(initialOwnerBalance);
    });
  });
}); 