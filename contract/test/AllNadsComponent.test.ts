import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther, zeroAddress } from "viem";

// 定义模板类型
interface ComponentTemplate {
  name: string;
  creator?: `0x${string}`;
  maxSupply: bigint;
  currentSupply: bigint;
  price: bigint;
  imageData: string;
  isActive: boolean;
  componentType: number;
}

describe("AllNadsComponent", function () {
  // 部署组件合约的测试夹具
  async function deployComponentFixture() {
    const [owner, creator, user1, user2] = await hre.viem.getWalletClients();
    
    // 先部署 PNGHeaderLib 库
    const pngHeaderLibFactory = await hre.viem.deployContract("PNGHeaderLib");
    
    // 部署组件合约，链接库
    const component = await hre.viem.deployContract("AllNadsComponent", [], {
      libraries: {
        "contracts/lib/PNGHeaderLib.sol:PNGHeaderLib": pngHeaderLibFactory.address
      }
    });
    
    // 设置 AllNadsContract 为 owner 地址 (模拟主合约)
    await component.write.setAllNadsContract([getAddress(owner.account.address)]);
    
    // 创建一个样例模板用于测试
    const backgroundTemplateData = {
      name: "Test Background",
      componentType: 0, // BACKGROUND
      maxSupply: 100n,
      price: parseEther("0.1"),
      imageData: "TestImageDataBackground", // 简化的图像数据
      isActive: true
    };
    
    // 使用owner地址创建交互客户端
    const publicClient = await hre.viem.getPublicClient();
    const ownerClient = await hre.viem.getContractAt(
      "AllNadsComponent",
      component.address,
      { client: { wallet: owner } }
    );
    
    // 创建示例模板
    const createTemplateTx = await ownerClient.write.createTemplate([
      backgroundTemplateData.name,
      backgroundTemplateData.maxSupply,
      backgroundTemplateData.price,
      backgroundTemplateData.imageData,
      backgroundTemplateData.componentType
    ], {
      value: parseEther("0.1") // 支付模板创建费用
    });
    
    await publicClient.waitForTransactionReceipt({ hash: createTemplateTx });
    
    // 通常模板ID从1开始
    const backgroundTemplateId = 1n;
    
    return {
      component,
      owner,
      creator,
      user1,
      user2,
      backgroundTemplateId,
      backgroundTemplateData,
      ownerClient,
      publicClient
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { component, owner } = await loadFixture(deployComponentFixture);
      
      const contractOwner = await component.read.owner();
      expect(contractOwner).to.equal(getAddress(owner.account.address));
    });
  });

  describe("Template Management", function () {
    it("Should create template correctly", async function () {
      const { component, backgroundTemplateId, backgroundTemplateData } = await loadFixture(deployComponentFixture);
      
      const templateResult = await component.read.getTemplate([backgroundTemplateId]);
      const template = templateResult as unknown as ComponentTemplate;
      
      expect(template.name).to.equal(backgroundTemplateData.name);
      expect(template.componentType).to.equal(backgroundTemplateData.componentType);
      expect(template.maxSupply).to.equal(backgroundTemplateData.maxSupply);
      expect(template.price).to.equal(backgroundTemplateData.price);
      expect(template.imageData).to.equal(backgroundTemplateData.imageData);
      expect(template.isActive).to.equal(backgroundTemplateData.isActive);
    });

    it("Should set the creator correctly when creating template", async function () {
      const { component, creator, publicClient } = await loadFixture(deployComponentFixture);
      
      // Create a template using the creator account
      const creatorClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: creator } }
      );
      
      // Template data
      const templateData = {
        name: "Creator Test Template",
        componentType: 0, // BACKGROUND
        maxSupply: 100n,
        price: parseEther("0.1"),
        imageData: "CreatorTestImageData",
        isActive: true
      };
      
      // Create template
      const createTemplateTx = await creatorClient.write.createTemplate([
        templateData.name,
        templateData.maxSupply,
        templateData.price,
        templateData.imageData,
        templateData.componentType
      ], {
        value: parseEther("0.1") // Pay template creation fee
      });
      
      await publicClient.waitForTransactionReceipt({ hash: createTemplateTx });
      
      // Get the template (it should be template ID 2 since one was created in the fixture)
      const templateId = 2n;
      const templateResult = await component.read.getTemplate([templateId]);
      const template = templateResult as unknown as ComponentTemplate;
      
      // Verify the creator is set correctly
      expect(template.creator).to.equal(getAddress(creator.account.address));
    });

    it("Should update template", async function () {
      const { component, backgroundTemplateId, ownerClient, publicClient } = await loadFixture(deployComponentFixture);
      
      // 更新模板价格
      const newPrice = parseEther("0.02");
      const tx = await ownerClient.write.updateTemplatePrice([backgroundTemplateId, newPrice]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      const templateResult = await component.read.getTemplate([backgroundTemplateId]);
      const updatedTemplate = templateResult as unknown as ComponentTemplate;
      
      expect(updatedTemplate.price).to.equal(newPrice);
    });

    it("Should get template type correctly", async function () {
      const { component, backgroundTemplateId, backgroundTemplateData } = await loadFixture(deployComponentFixture);
      
      const templateType = await component.read.getTemplateType([backgroundTemplateId]);
      expect(templateType).to.equal(backgroundTemplateData.componentType);
    });
  });

  describe("Component Minting", function () {
    it("Should mint component correctly", async function () {
      const { component, backgroundTemplateId, user1, publicClient } = await loadFixture(deployComponentFixture);
      
      // 获取模板详情以了解价格
      const templateResult = await component.read.getTemplate([backgroundTemplateId]);
      const template = templateResult as unknown as ComponentTemplate;
      
      // 使用user1创建客户端
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造组件
      const mintTx = await user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: template.price }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 组件ID从1开始
      const componentId = 1n;
      
      // 检查余额
      const balance = await component.read.balanceOf([getAddress(user1.account.address), componentId]);
      expect(balance).to.equal(1n);
      
      // 检查组件模板信息
      const tokenTemplate = await component.read.getTokenTemplate([componentId]);
      expect(tokenTemplate).to.equal(backgroundTemplateId);
    });

    it("Should not mint if price is insufficient", async function () {
      const { component, backgroundTemplateId, user1 } = await loadFixture(deployComponentFixture);
      
      // 使用user1创建客户端
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      // 尝试不付足够的费用铸造
      await expect(user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: 0n }
      )).to.be.rejectedWith(/Incorrect payment/);
    });
  });

  describe("Equipped Status", function () {
    it("Should set and check equipped status correctly", async function () {
      const { component, backgroundTemplateId, user1, publicClient, ownerClient } = await loadFixture(deployComponentFixture);
      
      // 获取模板详情以了解价格
      const templateResult = await component.read.getTemplate([backgroundTemplateId]);
      const template = templateResult as unknown as ComponentTemplate;
      
      // 使用user1创建客户端
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造组件
      const mintTx = await user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: template.price }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 组件ID从1开始
      const componentId = 1n;
      
      // 设置为已装备
      const setEquippedTx = await ownerClient.write.setEquippedStatus([componentId, true]);
      await publicClient.waitForTransactionReceipt({ hash: setEquippedTx });
      
      // 检查装备状态
      const isEquipped = await component.read.isEquipped([componentId]);
      expect(isEquipped).to.be.true;
      
      // 检查不能转移已装备组件
      await expect(user1Client.write.safeTransferFrom([
        getAddress(user1.account.address),
        getAddress(user1.account.address),
        componentId,
        1n,
        "0x"
      ])).to.be.rejectedWith(/Cannot transfer equipped component/);
    });
  });

  describe("Batch Operations", function () {
    it("Should mint batch components", async function () {
      const { component, ownerClient, publicClient, owner } = await loadFixture(deployComponentFixture);
      
      // 创建多个不同类型的模板
      const templates = [
        {
          name: "Hairstyle 1",
          componentType: 1, // HAIRSTYLE
          maxSupply: 100n,
          price: parseEther("0.1"),
          imageData: "TestImageDataHairstyle",
          isActive: true
        },
        {
          name: "Eyes 1",
          componentType: 2, // EYES
          maxSupply: 100n,
          price: parseEther("0.1"),
          imageData: "TestImageDataEyes",
          isActive: true
        }
      ];
      
      // 创建两个额外模板
      for (const template of templates) {
        const tx = await ownerClient.write.createTemplate([
          template.name,
          template.maxSupply,
          template.price,
          template.imageData,
          template.componentType
        ], {
          value: parseEther("0.1") // 支付模板创建费用
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      
      // 准备批量铸造数据
      const templateIds = [1n, 2n, 3n]; // 背景、发型、眼睛
      const destination = getAddress(owner.account.address);
      
      // 铸造批量组件
      const batchMintTx = await ownerClient.write.mintComponents(
        [templateIds, destination],
        { value: parseEther("0.3") } // 0.1 * 3
      );
      await publicClient.waitForTransactionReceipt({ hash: batchMintTx });
      
      // 检查每个组件的余额
      for (let i = 0; i < templateIds.length; i++) {
        const componentId = BigInt(i + 1);
        const balance = await component.read.balanceOf([destination, componentId]);
        expect(balance).to.equal(1n);
      }
    });
  });

  describe("Get Token Full Template", function () {
    it("Should get token full template correctly", async function () {
      const { component, backgroundTemplateId, backgroundTemplateData, user1, publicClient } = await loadFixture(deployComponentFixture);
      
      // 获取模板详情以了解价格
      const templateResult = await component.read.getTemplate([backgroundTemplateId]);
      const template = templateResult as unknown as ComponentTemplate;
      
      // 使用user1创建客户端
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造组件
      const mintTx = await user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: template.price }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 组件ID从1开始
      const componentId = 1n;
      
      // 测试我们新添加的方法
      const fullTemplateResult = await component.read.getTokenFullTemplate([componentId]);
      const fullTemplate = fullTemplateResult as unknown as ComponentTemplate;
      
      expect(fullTemplate.name).to.equal(backgroundTemplateData.name);
      expect(fullTemplate.componentType).to.equal(backgroundTemplateData.componentType);
      expect(fullTemplate.maxSupply).to.equal(backgroundTemplateData.maxSupply);
      expect(fullTemplate.price).to.equal(backgroundTemplateData.price);
      expect(fullTemplate.imageData).to.equal(backgroundTemplateData.imageData);
      expect(fullTemplate.isActive).to.equal(backgroundTemplateData.isActive);
    });
  });

  describe("Permission Controls", function () {
    it("Should prevent non-owner from setting AllNads contract", async function () {
      const { component, user1 } = await loadFixture(deployComponentFixture);
      
      // 使用user1创建客户端
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      // 尝试设置 AllNads 合约地址 (应该失败)
      await expect(user1Client.write.setAllNadsContract([getAddress(user1.account.address)]))
        .to.be.rejected;
    });
    
    it("Should prevent non-AllNads contract from setting equipped status", async function () {
      const { component, backgroundTemplateId, user1, publicClient } = await loadFixture(deployComponentFixture);
      
      // 使用user1创建客户端
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      // 铸造组件
      const mintTx = await user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 尝试设置装备状态 (应该失败，因为不是 AllNads 合约)
      await expect(user1Client.write.setEquippedStatus([1n, true]))
        .to.be.rejectedWith(/Only AllNads contract/i);
    });
    
    it("Should prevent creators from updating templates they didn't create", async function () {
      const { component, backgroundTemplateId, user1, creator, publicClient } = await loadFixture(deployComponentFixture);
      
      // 使用creator创建一个新模板
      const creatorClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: creator } }
      );
      
      // 创建一个新模板
      const createTx = await creatorClient.write.createTemplate([
        "Creator Template",
        100n,
        parseEther("0.1"),
        "CreatorTemplateImage",
        1 // HAIRSTYLE
      ], { value: parseEther("0.1") });
      
      await publicClient.waitForTransactionReceipt({ hash: createTx });
      
      // user1 尝试更新 creator 创建的模板价格
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      await expect(user1Client.write.updateTemplatePrice([2n, parseEther("0.02")]))
        .to.be.rejected;
    });
  });
  
  describe("Edge Cases", function () {
    it("Should fail when creating template with empty name", async function () {
      const { component, creator } = await loadFixture(deployComponentFixture);
      
      // 使用creator客户端
      const creatorClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: creator } }
      );
      
      // 尝试创建空名称模板
      await expect(creatorClient.write.createTemplate([
        "", // 空名称
        100n,
        parseEther("0.1"),
        "TestImageData",
        0 // BACKGROUND
      ], { value: parseEther("0.1") }))
        .to.be.rejectedWith(/Name cannot be empty/i);
    });
    
    it("Should fail when minting from inactive template", async function () {
      const { component, backgroundTemplateId, user1, owner, publicClient } = await loadFixture(deployComponentFixture);
      
      // 使用owner停用模板
      const ownerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      // 停用模板
      const deactivateTx = await ownerClient.write.toggleTemplateStatus([backgroundTemplateId]);
      await publicClient.waitForTransactionReceipt({ hash: deactivateTx });
      
      // 使用user1尝试从停用的模板铸造
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      await expect(user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      )).to.be.rejected;
    });
    
    it("Should fail when minting beyond max supply", async function () {
      const { component, owner, user1, publicClient } = await loadFixture(deployComponentFixture);
      
      // 创建一个有限供应的模板
      const ownerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      // 创建供应量为1的模板
      const createTx = await ownerClient.write.createTemplate([
        "Limited Template",
        1n, // 最大供应量 = 1
        parseEther("0.1"),
        "LimitedTemplateImage",
        0 // BACKGROUND
      ], { value: parseEther("0.1") });
      
      await publicClient.waitForTransactionReceipt({ hash: createTx });
      const limitedTemplateId = 2n;
      
      // 用户铸造第一个组件 (应该成功)
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      const mintTx = await user1Client.write.mintComponent(
        [limitedTemplateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 再次铸造应该失败 (已超过最大供应量)
      await expect(user1Client.write.mintComponent(
        [limitedTemplateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      )).to.be.rejectedWith(/Max supply reached/i);
    });
  });
  
  describe("Fee and Economic Model", function () {
    it("Should calculate creator royalties correctly", async function () {
      const { component, creator, user1, publicClient } = await loadFixture(deployComponentFixture);
      
      // 使用creator创建一个模板
      const creatorClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: creator } }
      );
      
      const createTx = await creatorClient.write.createTemplate([
        "Creator Template",
        100n,
        parseEther("0.1"),
        "CreatorTemplateImage",
        0 // BACKGROUND
      ], { value: parseEther("0.1") });
      
      await publicClient.waitForTransactionReceipt({ hash: createTx });
      const templateId = 2n;
      
      // 获取创建者版税比例
      const royaltyPercentage = await component.read.creatorRoyaltyPercentage();
      
      // 记录创建者初始余额
      const initialCreatorBalance = await publicClient.getBalance({ address: creator.account.address });
      
      // 用user1铸造组件
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      const mintTx = await user1Client.write.mintComponent(
        [templateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 检查创建者余额增加了正确的版税金额
      const finalCreatorBalance = await publicClient.getBalance({ address: creator.account.address });
      const royaltyAmount = parseEther("0.1") * royaltyPercentage / 100n;
      
      expect(finalCreatorBalance - initialCreatorBalance).to.equal(royaltyAmount);
    });
    
    it("Should allow owner to update template creation fee", async function () {
      const { component, owner, publicClient } = await loadFixture(deployComponentFixture);
      
      // 获取当前模板创建费用
      const initialFee = await component.read.templateCreationFee();
      
      // 使用owner更新费用
      const ownerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      const newFee = parseEther("0.02");
      const updateFeeTx = await ownerClient.write.setTemplateCreationFee([newFee]);
      await publicClient.waitForTransactionReceipt({ hash: updateFeeTx });
      
      // 验证费用更新
      const updatedFee = await component.read.templateCreationFee();
      expect(updatedFee).to.equal(newFee);
    });
    
    it("Should allow owner to update creator royalty percentage", async function () {
      const { component, owner, publicClient } = await loadFixture(deployComponentFixture);
      
      // 获取当前创建者版税比例
      const initialRoyalty = await component.read.creatorRoyaltyPercentage();
      
      // 使用owner更新版税比例
      const ownerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      const newRoyalty = 20n;
      const updateRoyaltyTx = await ownerClient.write.setCreatorRoyaltyPercentage([newRoyalty]);
      await publicClient.waitForTransactionReceipt({ hash: updateRoyaltyTx });
      
      // 验证版税比例更新
      const updatedRoyalty = await component.read.creatorRoyaltyPercentage();
      expect(updatedRoyalty).to.equal(newRoyalty);
    });
  });
  
  describe("Template State Management", function () {
    it("Should allow activating and deactivating templates", async function () {
      const { component, backgroundTemplateId, owner, publicClient } = await loadFixture(deployComponentFixture);
      
      // 使用owner管理模板状态
      const ownerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      // 停用模板
      const deactivateTx = await ownerClient.write.toggleTemplateStatus([backgroundTemplateId]);
      await publicClient.waitForTransactionReceipt({ hash: deactivateTx });
      
      // 验证模板状态
      let template = await component.read.getTemplate([backgroundTemplateId]);
      expect(template.isActive).to.be.false;
      
      // 重新激活模板
      const activateTx = await ownerClient.write.toggleTemplateStatus([backgroundTemplateId]);
      await publicClient.waitForTransactionReceipt({ hash: activateTx });
      
      // 再次验证模板状态
      template = await component.read.getTemplate([backgroundTemplateId]);
      expect(template.isActive).to.be.true;
    });
  });
  
  describe("Component Transfer and Interaction", function () {
    it("Should prevent transfer of equipped components", async function () {
      const { component, backgroundTemplateId, user1, owner, publicClient } = await loadFixture(deployComponentFixture);
      
      // 铸造组件
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      const mintTx = await user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 将组件标记为已装备
      const ownerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      const equipTx = await ownerClient.write.setEquippedStatus([1n, true]);
      await publicClient.waitForTransactionReceipt({ hash: equipTx });
      
      // 尝试转移已装备的组件 (应该失败)
      await expect(user1Client.write.safeTransferFrom([
        getAddress(user1.account.address),
        getAddress(owner.account.address),
        1n,
        1n,
        "0x"
      ])).to.be.rejectedWith(/Cannot transfer equipped component/i);
    });
    
    it("Should allow transfer after unequipping", async function () {
      const { component, backgroundTemplateId, user1, user2, owner, publicClient } = await loadFixture(deployComponentFixture);
      
      // 铸造组件
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      const mintTx = await user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 先将组件标记为已装备
      const ownerClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: owner } }
      );
      
      let equipTx = await ownerClient.write.setEquippedStatus([1n, true]);
      await publicClient.waitForTransactionReceipt({ hash: equipTx });
      
      // 再将组件解除装备
      equipTx = await ownerClient.write.setEquippedStatus([1n, false]);
      await publicClient.waitForTransactionReceipt({ hash: equipTx });
      
      // 现在应该可以转移了
      const transferTx = await user1Client.write.safeTransferFrom([
        getAddress(user1.account.address),
        getAddress(user2.account.address),
        1n,
        1n,
        "0x"
      ]);
      await publicClient.waitForTransactionReceipt({ hash: transferTx });
      
      // 验证组件已转移
      const balance1 = await component.read.balanceOf([getAddress(user1.account.address), 1n]);
      const balance2 = await component.read.balanceOf([getAddress(user2.account.address), 1n]);
      
      expect(balance1).to.equal(0n);
      expect(balance2).to.equal(1n);
    });
  });
  
  describe("URI and Metadata", function () {
    it("Should generate correct URI for components", async function () {
      const { component, backgroundTemplateId, user1, publicClient } = await loadFixture(deployComponentFixture);
      
      // 铸造组件
      const user1Client = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: user1 } }
      );
      
      const mintTx = await user1Client.write.mintComponent(
        [backgroundTemplateId, getAddress(user1.account.address)],
        { value: parseEther("0.1") }
      );
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      
      // 获取组件的URI
      const tokenURI = await component.read.uri([1n]);
      
      // URI应该包含正确的元数据
      expect(tokenURI).to.include("data:application/json");
      expect(tokenURI).to.include("AllNads Background");
      expect(tokenURI).to.include("image");
      expect(tokenURI).to.include("TestImageDataBackground");
    });
  });
  
  describe("Image Data and PNG Processing", function () {
    it("Should validate PNG data format", async function () {
      const { component, creator } = await loadFixture(deployComponentFixture);
      
      // 准备一个PNG头部的简单模拟
      const validPNGHeader = "iVBORw0KGgo="; // 模拟PNG头部
      const invalidPNGHeader = "INVALID";
      
      // 使用creator创建新模板
      const creatorClient = await hre.viem.getContractAt(
        "AllNadsComponent",
        component.address,
        { client: { wallet: creator } }
      );
      
      // 创建使用有效PNG数据的模板 (应该成功)
      await expect(creatorClient.write.createTemplate([
        "Valid PNG Template",
        100n,
        parseEther("0.1"),
        validPNGHeader,
        0 // BACKGROUND
      ], { value: parseEther("0.1") })).to.not.be.rejected;
    });
  });
}); 