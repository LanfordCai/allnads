// @ts-nocheck
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import hre from "hardhat";
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

describe("AllNadsComponentQuery", function () {
  // 部署合约的测试夹具
  async function deployContractsFixture() {
    const [owner, creator, user1, user2] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    
    // 先部署 PNGHeaderLib 库
    const pngHeaderLibFactory = await hre.viem.deployContract("PNGHeaderLib");
    
    // 部署组件合约，链接库
    const allNadsComponent = await hre.viem.deployContract("AllNadsComponent", [], {
      libraries: {
        "contracts/lib/PNGHeaderLib.sol:PNGHeaderLib": pngHeaderLibFactory.address
      }
    });
    
    // 设置 AllNadsContract 为 owner 地址 (模拟主合约)
    await allNadsComponent.write.setAllNadsContract([getAddress(owner.account.address)]);
    
    // 部署查询合约
    const allNadsComponentQuery = await hre.viem.deployContract("AllNadsComponentQuery", [
      allNadsComponent.address
    ]);
    
    // 创建各种组件类型的模板数据
    const templateData = [
      {
        name: "Background 1",
        componentType: 0, // BACKGROUND
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Background 2",
        componentType: 0, // BACKGROUND
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Hairstyle 1",
        componentType: 1, // HAIRSTYLE
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Hairstyle 2",
        componentType: 1, // HAIRSTYLE
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Eyes 1",
        componentType: 2, // EYES
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Eyes 2",
        componentType: 2, // EYES
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Mouth 1",
        componentType: 3, // MOUTH
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Mouth 2",
        componentType: 3, // MOUTH
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Accessory 1",
        componentType: 4, // ACCESSORY
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      },
      {
        name: "Accessory 2",
        componentType: 4, // ACCESSORY
        maxSupply: 100n,
        price: parseEther("0.01"),
        imageData: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        isActive: true
      }
    ];
    
    // 使用creator创建客户端
    const creatorClient = await hre.viem.getContractAt(
      "AllNadsComponent",
      allNadsComponent.address,
      { client: { wallet: creator } }
    );
    
    // 创建模板并存储模板ID
    const templateIds: bigint[] = [];
    const templateCreationFee = parseEther("0.1");
    
    for (const template of templateData) {
      const tx = await creatorClient.write.createTemplate(
        [
          template.name,
          template.maxSupply,
          template.price,
          template.imageData,
          template.componentType
        ],
        { value: templateCreationFee }
      );
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 模板ID从1开始，按顺序递增
      templateIds.push(BigInt(templateIds.length + 1));
    }
    
    return { 
      allNadsComponent, 
      allNadsComponentQuery, 
      owner, 
      creator, 
      user1, 
      user2,
      templateIds,
      templateData,
      publicClient
    };
  }

  // 部署、创建模板并铸造组件的测试夹具
  async function deployAndMintFixture() {
    const { 
      allNadsComponent, 
      allNadsComponentQuery, 
      owner, 
      creator, 
      user1, 
      user2, 
      templateIds,
      templateData,
      publicClient
    } = await loadFixture(deployContractsFixture);
    
    // 为user1铸造组件 - 每种类型的第一个模板
    const user1TemplateIds = [templateIds[0], templateIds[2], templateIds[4], templateIds[6], templateIds[8]];
    
    // 使用user1创建客户端
    const user1Client = await hre.viem.getContractAt(
      "AllNadsComponent",
      allNadsComponent.address,
      { client: { wallet: user1 } }
    );
    
    // 计算总价格
    let totalPrice = 0n;
    for (let i = 0; i < user1TemplateIds.length; i++) {
      const templateIndex = Number(user1TemplateIds[i]) - 1;
      totalPrice += templateData[templateIndex].price;
    }
    
    // 铸造组件
    const mintTx = await user1Client.write.mintComponents(
      [user1TemplateIds, getAddress(user1.account.address)],
      { value: totalPrice }
    );
    
    await publicClient.waitForTransactionReceipt({ hash: mintTx });
    
    // 为user2铸造组件 - 每种类型的第二个模板 + 第一个背景和眼睛
    const user2TemplateIds = [
      templateIds[1], templateIds[3], templateIds[5], templateIds[7], templateIds[9], // 第二个模板
      templateIds[0], templateIds[4] // 额外的背景和眼睛
    ];
    
    // 使用user2创建客户端
    const user2Client = await hre.viem.getContractAt(
      "AllNadsComponent",
      allNadsComponent.address,
      { client: { wallet: user2 } }
    );
    
    // 计算总价格
    totalPrice = 0n;
    for (let i = 0; i < user2TemplateIds.length; i++) {
      const templateIndex = Number(user2TemplateIds[i]) - 1;
      totalPrice += templateData[templateIndex].price;
    }
    
    // 铸造组件
    const mintTx2 = await user2Client.write.mintComponents(
      [user2TemplateIds, getAddress(user2.account.address)],
      { value: totalPrice }
    );
    
    await publicClient.waitForTransactionReceipt({ hash: mintTx2 });
    
    // 计算组件ID
    const user1ComponentIds = user1TemplateIds.map((_, index) => BigInt(index + 1));
    const user2ComponentIds = user2TemplateIds.map((_, index) => BigInt(index + user1ComponentIds.length + 1));
    
    return { 
      allNadsComponent, 
      allNadsComponentQuery, 
      owner, 
      creator, 
      user1, 
      user2, 
      templateIds,
      templateData,
      user1TemplateIds,
      user2TemplateIds,
      user1ComponentIds,
      user2ComponentIds,
      publicClient
    };
  }

  describe("Deployment", function () {
    it("Should set the correct component contract address", async function () {
      const { allNadsComponent, allNadsComponentQuery } = await loadFixture(deployContractsFixture);
      
      const componentContractAddress = await allNadsComponentQuery.read.componentContract();
      expect(getAddress(componentContractAddress)).to.equal(getAddress(allNadsComponent.address));
    });
  });

  describe("Batch Check Template Ownership", function () {
    it("Should correctly identify owned templates", async function () {
      const { 
        allNadsComponentQuery, 
        user1, 
        user1TemplateIds 
      } = await loadFixture(deployAndMintFixture);
      
      const [ownedTemplates, tokenIds] = await allNadsComponentQuery.read.batchCheckTemplateOwnership([
        getAddress(user1.account.address),
        user1TemplateIds
      ]);
      
      // All templates should be owned
      expect(ownedTemplates.every(owned => owned === true)).to.be.true;
      
      // All token IDs should be non-zero
      expect(tokenIds.every(tokenId => tokenId > 0n)).to.be.true;
    });

    it("Should correctly identify non-owned templates", async function () {
      const { 
        allNadsComponentQuery, 
        user1, 
        user2TemplateIds 
      } = await loadFixture(deployAndMintFixture);
      
      // User1 doesn't own user2's unique templates
      const nonOwnedTemplateIds = user2TemplateIds.slice(0, 5); // 只取user2独有的模板
      
      const [ownedTemplates, tokenIds] = await allNadsComponentQuery.read.batchCheckTemplateOwnership([
        getAddress(user1.account.address),
        nonOwnedTemplateIds
      ]);
      
      // All templates should be non-owned
      expect(ownedTemplates.every(owned => owned === false)).to.be.true;
      
      // All token IDs should be zero
      expect(tokenIds.every(tokenId => tokenId === 0n)).to.be.true;
    });

    it("Should handle mixed owned and non-owned templates", async function () {
      const { 
        allNadsComponentQuery, 
        user1, 
        user1TemplateIds,
        user2TemplateIds
      } = await loadFixture(deployAndMintFixture);
      
      // Mix of owned and non-owned templates
      const mixedTemplateIds = [user1TemplateIds[0], user2TemplateIds[0], user1TemplateIds[1], user2TemplateIds[1]];
      
      const [ownedTemplates, tokenIds] = await allNadsComponentQuery.read.batchCheckTemplateOwnership([
        getAddress(user1.account.address),
        mixedTemplateIds
      ]);
      
      // First and third templates should be owned
      expect(ownedTemplates[0]).to.be.true;
      expect(ownedTemplates[2]).to.be.true;
      
      // Second and fourth templates should not be owned
      expect(ownedTemplates[1]).to.be.false;
      expect(ownedTemplates[3]).to.be.false;
      
      // Token IDs for owned templates should be non-zero
      expect(tokenIds[0] > 0n).to.be.true;
      expect(tokenIds[2] > 0n).to.be.true;
      
      // Token IDs for non-owned templates should be zero
      expect(tokenIds[1]).to.equal(0n);
      expect(tokenIds[3]).to.equal(0n);
    });
  });

  describe("Get Owned Templates By Type", function () {
    it("Should return correct templates for each component type", async function () {
      const { 
        allNadsComponentQuery, 
        user1
      } = await loadFixture(deployAndMintFixture);
      
      // Check each component type
      for (let componentType = 0; componentType < 5; componentType++) {
        const [ownedTemplateIds, ownedTokenIds] = await allNadsComponentQuery.read.getOwnedTemplatesByType([
          getAddress(user1.account.address),
          componentType
        ]);
        
        // User1 should own exactly one template of each type
        expect(ownedTemplateIds.length).to.equal(1);
        expect(ownedTokenIds.length).to.equal(1);
        
        // Token ID should be non-zero
        expect(ownedTokenIds[0] > 0n).to.be.true;
      }
    });

    it("Should return multiple templates of the same type when owned", async function () {
      const { 
        allNadsComponentQuery, 
        user2
      } = await loadFixture(deployAndMintFixture);
      
      // User2 owns two BACKGROUND templates (type 0)
      const [ownedTemplateIds, ownedTokenIds] = await allNadsComponentQuery.read.getOwnedTemplatesByType([
        getAddress(user2.account.address),
        0 // BACKGROUND
      ]);
      
      // Should have 2 templates
      expect(ownedTemplateIds.length).to.equal(2);
      expect(ownedTokenIds.length).to.equal(2);
      
      // Both token IDs should be non-zero
      expect(ownedTokenIds[0] > 0n).to.be.true;
      expect(ownedTokenIds[1] > 0n).to.be.true;
    });

    it("Should return empty arrays when no templates of a type are owned", async function () {
      const { 
        allNadsComponentQuery, 
        owner // Owner doesn't own any templates
      } = await loadFixture(deployAndMintFixture);
      
      const [ownedTemplateIds, ownedTokenIds] = await allNadsComponentQuery.read.getOwnedTemplatesByType([
        getAddress(owner.account.address),
        0 // BACKGROUND
      ]);
      
      // Should have no templates
      expect(ownedTemplateIds.length).to.equal(0);
      expect(ownedTokenIds.length).to.equal(0);
    });
  });

  describe("Get All Owned Templates", function () {
    it("Should return all templates owned by a user", async function () {
      const { 
        allNadsComponentQuery, 
        user1, 
        user1TemplateIds
      } = await loadFixture(deployAndMintFixture);
      
      const [ownedTemplateIds, templateTypes, tokenIds] = await allNadsComponentQuery.read.getAllOwnedTemplates([
        getAddress(user1.account.address)
      ]);
      
      // Should have 5 templates (one of each type)
      expect(ownedTemplateIds.length).to.equal(5);
      expect(templateTypes.length).to.equal(5);
      expect(tokenIds.length).to.equal(5);
      
      // All token IDs should be non-zero
      expect(tokenIds.every(tokenId => tokenId > 0n)).to.be.true;
      
      // Template IDs should match what user1 minted
      for (const templateId of user1TemplateIds) {
        expect(ownedTemplateIds.some(id => id === templateId)).to.be.true;
      }
      
      // Should have one of each component type
      const uniqueTypes = new Set(templateTypes.map(type => Number(type)));
      expect(uniqueTypes.size).to.equal(5);
    });

    it("Should return all templates including duplicates of the same type", async function () {
      const { 
        allNadsComponentQuery, 
        user2, 
        user2TemplateIds
      } = await loadFixture(deployAndMintFixture);
      
      const [ownedTemplateIds, templateTypes, tokenIds] = await allNadsComponentQuery.read.getAllOwnedTemplates([
        getAddress(user2.account.address)
      ]);
      
      // Should have 7 templates (including duplicates)
      expect(ownedTemplateIds.length).to.equal(7);
      expect(templateTypes.length).to.equal(7);
      expect(tokenIds.length).to.equal(7);
      
      // All token IDs should be non-zero
      expect(tokenIds.every(tokenId => tokenId > 0n)).to.be.true;
      
      // Template IDs should match what user2 minted
      for (const templateId of user2TemplateIds) {
        expect(ownedTemplateIds.some(id => id === templateId)).to.be.true;
      }
      
      // Should have duplicates of type 0 (BACKGROUND) and type 2 (EYES)
      const typeCount = templateTypes.reduce((acc, type) => {
        const typeNumber = Number(type);
        acc[typeNumber] = (acc[typeNumber] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      
      expect(typeCount[0]).to.equal(2); // 2 BACKGROUND templates
      expect(typeCount[2]).to.equal(2); // 2 EYES templates
    });

    it("Should return empty arrays when no templates are owned", async function () {
      const { 
        allNadsComponentQuery, 
        owner // Owner doesn't own any templates
      } = await loadFixture(deployAndMintFixture);
      
      const [ownedTemplateIds, templateTypes, tokenIds] = await allNadsComponentQuery.read.getAllOwnedTemplates([
        getAddress(owner.account.address)
      ]);
      
      // Should have no templates
      expect(ownedTemplateIds.length).to.equal(0);
      expect(templateTypes.length).to.equal(0);
      expect(tokenIds.length).to.equal(0);
    });
  });

  describe("Get Owned Template Counts", function () {
    it("Should return correct counts for each component type", async function () {
      const { 
        allNadsComponentQuery, 
        user1
      } = await loadFixture(deployAndMintFixture);
      
      const counts = await allNadsComponentQuery.read.getOwnedTemplateCounts([
        getAddress(user1.account.address)
      ]);
      
      // Should have 5 counts (one for each component type)
      expect(counts.length).to.equal(5);
      
      // User1 should own exactly one template of each type
      expect(counts.every(count => count === 1n)).to.be.true;
    });

    it("Should return correct counts including duplicates of the same type", async function () {
      const { 
        allNadsComponentQuery, 
        user2
      } = await loadFixture(deployAndMintFixture);
      
      const counts = await allNadsComponentQuery.read.getOwnedTemplateCounts([
        getAddress(user2.account.address)
      ]);
      
      // Should have 5 counts (one for each component type)
      expect(counts.length).to.equal(5);
      
      // User2 should own 2 BACKGROUND templates (type 0)
      expect(counts[0]).to.equal(2n);
      
      // User2 should own 2 EYES templates (type 2)
      expect(counts[2]).to.equal(2n);
      
      // User2 should own 1 template of each other type
      expect(counts[1]).to.equal(1n); // HAIRSTYLE
      expect(counts[3]).to.equal(1n); // MOUTH
      expect(counts[4]).to.equal(1n); // ACCESSORY
    });

    it("Should return zeros when no templates are owned", async function () {
      const { 
        allNadsComponentQuery, 
        owner // Owner doesn't own any templates
      } = await loadFixture(deployAndMintFixture);
      
      const counts = await allNadsComponentQuery.read.getOwnedTemplateCounts([
        getAddress(owner.account.address)
      ]);
      
      // Should have 5 counts (one for each component type)
      expect(counts.length).to.equal(5);
      
      // All counts should be zero
      for (let i = 0; i < counts.length; i++) {
        expect(counts[i]).to.equal(0n);
      }
    });
  });
}); 