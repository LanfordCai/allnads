import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther } from "viem";

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
    const componentFactory = await hre.viem.deployContract("AllNadsComponent", [], {
      libraries: {
        "contracts/lib/PNGHeaderLib.sol:PNGHeaderLib": pngHeaderLibFactory.address
      }
    });
    
    const component = await hre.viem.getContractAt(
      "AllNadsComponent",
      componentFactory.address
    );
    
    // 设置 AllNadsContract 为 owner 地址 (模拟主合约)
    await component.write.setAllNadsContract([getAddress(owner.account.address)]);
    
    // 创建一个样例模板用于测试
    const backgroundTemplateData = {
      name: "Test Background",
      componentType: 0, // BACKGROUND
      maxSupply: 100n,
      price: parseEther("0.01"),
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
      value: parseEther("0.01") // 支付模板创建费用
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
          price: parseEther("0.01"),
          imageData: "TestImageDataHairstyle",
          isActive: true
        },
        {
          name: "Eyes 1",
          componentType: 2, // EYES
          maxSupply: 100n,
          price: parseEther("0.01"),
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
          value: parseEther("0.01") // 支付模板创建费用
        });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      
      // 准备批量铸造数据
      const templateIds = [1n, 2n, 3n]; // 背景、发型、眼睛
      const destination = getAddress(owner.account.address);
      
      // 铸造批量组件
      const batchMintTx = await ownerClient.write.mintComponents(
        [templateIds, destination],
        { value: parseEther("0.03") } // 0.01 * 3
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
}); 