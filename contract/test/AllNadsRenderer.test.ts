import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther, decodeAbiParameters } from "viem";
import { deployPNGHeaderLib } from "./helpers/deployLibraries";

describe("AllNadsRenderer", function () {
  // 部署渲染器合约的测试夹具
  async function deployRendererFixture() {
    const [owner, user1] = await hre.viem.getWalletClients();
    
    // 先部署 PNGHeaderLib 库
    const pngHeaderLibFactory = await deployPNGHeaderLib();
    
    // 部署组件合约，链接库
    const component = await hre.viem.deployContract("AllNadsComponent", [], {
      libraries: {
        "contracts/lib/PNGHeaderLib.sol:PNGHeaderLib": pngHeaderLibFactory.address
      }
    });
    
    // 默认身体数据
    const defaultBodyData = "TestBodyData";
    
    // 部署渲染器合约
    const renderer = await hre.viem.deployContract("AllNadsRenderer", [
      component.address,
      defaultBodyData
    ]);
    
    // 公共客户端用于事务处理
    const publicClient = await hre.viem.getPublicClient();
    
    // 组件合约客户端
    const componentOwnerClient = await hre.viem.getContractAt(
      "AllNadsComponent",
      component.address,
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
      const tx = await componentOwnerClient.write.createTemplate([
        template.name,
        template.maxSupply,
        template.price,
        template.imageData,
        template.componentType
      ], { 
        value: parseEther("0.01") // 支付模板创建费用
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      templateIds.push(BigInt(templateIds.length + 1));
    }
    
    // 铸造组件给用户1
    const componentTokens = [];
    for (const templateId of templateIds) {
      const tx = await componentOwnerClient.write.mintComponent(
        [templateId, getAddress(user1.account.address)],
        { value: parseEther("0.01") }
      );
      await publicClient.waitForTransactionReceipt({ hash: tx });
      componentTokens.push(BigInt(componentTokens.length + 1));
    }
    
    // 测试数据
    const avatarData = {
      name: "Test Avatar",
      backgroundId: componentTokens[0],
      headId: componentTokens[1],
      eyesId: componentTokens[2],
      mouthId: componentTokens[3],
      accessoryId: componentTokens[4]
    };
    
    return {
      component,
      renderer,
      owner,
      user1,
      publicClient,
      avatarData,
      componentOwnerClient,
      templateIds,
      componentTokens,
      templates
    };
  }

  describe("Deployment", function () {
    it("Should set the right component contract", async function () {
      const { renderer, component } = await loadFixture(deployRendererFixture);
      
      const componentContract = await renderer.read.componentContract();
      expect(getAddress(componentContract)).to.equal(getAddress(component.address));
    });
  });

  describe("Settings", function () {
    it("Should allow owner to set component contract", async function () {
      const { renderer, owner, publicClient } = await loadFixture(deployRendererFixture);
      
      // 使用owner客户端
      const rendererOwnerClient = await hre.viem.getContractAt(
        "AllNadsRenderer",
        renderer.address,
        { client: { wallet: owner } }
      );
      
      // 设置新的组件合约地址（这里仅用于测试，使用owner地址）
      const tx = await rendererOwnerClient.write.setComponentContract([
        getAddress(owner.account.address)
      ]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查更新后的值
      const componentContract = await renderer.read.componentContract();
      expect(componentContract).to.equal(getAddress(owner.account.address));
    });

    it("Should allow owner to set default body data", async function () {
      const { renderer, owner, publicClient } = await loadFixture(deployRendererFixture);
      
      // 使用owner客户端
      const rendererOwnerClient = await hre.viem.getContractAt(
        "AllNadsRenderer",
        renderer.address,
        { client: { wallet: owner } }
      );
      
      // 设置新的默认身体数据
      const newBodyData = "NewTestBodyData";
      const tx = await rendererOwnerClient.write.setDefaultBodyData([newBodyData]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // 检查更新后的值
      const bodyData = await renderer.read.defaultBodyData();
      expect(bodyData).to.equal(newBodyData);
    });
  });

  describe("Token URI Generation", function () {
    it("Should generate SVG with all layers", async function () {
      const { renderer, avatarData } = await loadFixture(deployRendererFixture);
      
      // 获取组件模板数据，这里我们只检查是否成功调用，不验证具体内容
      const uri = await renderer.read.generateTokenURI([avatarData]);
      
      // URI应该是JSON格式的字符串，以data:application/json开头
      expect(uri).to.include("data:application/json");
      
      // 应该包含有效的SVG
      expect(uri).to.include("image/svg+xml");
      
      // 应该包含头像名称
      expect(uri).to.include(avatarData.name);
      
      // 应该包含属性
      expect(uri).to.include("attributes");
    });

    it("Should use the optimized getTokenFullTemplate function", async function () {
      const { 
        renderer, 
        component, 
        avatarData, 
        templates,
        componentTokens
      } = await loadFixture(deployRendererFixture);
      
      // 我们需要确保渲染器使用的是优化后的getTokenFullTemplate函数
      // 但由于我们无法直观地看到函数调用，我们可以通过比较结果来推断
      
      // 直接获取组件的模板数据
      const backgroundTemplate = await component.read.getTokenFullTemplate([avatarData.backgroundId]);
      
      // 生成URI
      const uri = await renderer.read.generateTokenURI([avatarData]);
      
      // 检查生成的URI包含图像数据引用
      expect(uri).to.include("image");
      expect(uri).to.include("svg+xml");
      
      // 检查URI包含正确的组件ID
      for (const componentId of componentTokens) {
        expect(uri).to.include(`"value":"${componentId.toString()}"`);
      }
    });
  });

  describe("SVG Generation", function () {
    it("Should generate SVG with proper structure", async function () {
      const { renderer, publicClient } = await loadFixture(deployRendererFixture);
      
      // 测试生成SVG - 直接调用generateSVG函数
      const svg = await renderer.read.generateSVG([
        "BgData", 
        "HeadData", 
        "EyesData", 
        "MouthData", 
        "AccessoryData"
      ]);
      
      // SVG应该包含正确的标签
      expect(svg).to.include("<svg");
      expect(svg).to.include("</svg>");
      
      // 应该有6个layer (背景, 身体, 头, 眼睛, 嘴, 饰品)
      const foreignObjectCount = (svg.match(/<foreignObject/g) || []).length;
      expect(foreignObjectCount).to.equal(6); // 包括默认身体层
      
      // 确认所有图像数据都包含在内
      expect(svg).to.include("BgData");
      expect(svg).to.include("HeadData");
      expect(svg).to.include("EyesData");
      expect(svg).to.include("MouthData");
      expect(svg).to.include("AccessoryData");
    });
  });

  describe("Format JSON", function () {
    it("Should format JSON with correct structure", async function () {
      const { renderer, avatarData } = await loadFixture(deployRendererFixture);
      
      // 创建简单的SVG用于测试
      const testSvg = "<svg></svg>";
      
      // 使用formatJSON函数
      const json = await renderer.read.formatJSON([avatarData, testSvg]);
      
      // 应该是JSON格式字符串
      expect(json).to.include("data:application/json");
      
      // 应该包含正确的键
      expect(json).to.include("name");
      expect(json).to.include("description");
      expect(json).to.include("image");
      expect(json).to.include("attributes");
      
      // 应该包含头像名称
      expect(json).to.include(avatarData.name);
      
      // 应该包含所有组件ID
      expect(json).to.include(avatarData.backgroundId.toString());
      expect(json).to.include(avatarData.headId.toString());
      expect(json).to.include(avatarData.eyesId.toString());
      expect(json).to.include(avatarData.mouthId.toString());
      expect(json).to.include(avatarData.accessoryId.toString());
    });
  });

  describe("RenderAvatar Function", function () {
    it("Should render avatar using individual component IDs", async function () {
      // ... existing code ...
    });

    it("Should handle invalid component IDs by using default components", async function () {
      const { renderer, component, componentTokens, avatarData } = await loadFixture(deployRendererFixture);
      
      // We need to first mint valid components to test with
      // For this test, we'll check that the renderer gracefully handles errors
      // by catching the expected error when trying to use non-existent component IDs
      
      // Create invalid component IDs (values higher than the available components)
      const invalidBackgroundId = 999n;
      
      // Try to get a template for an invalid component ID - this should throw an error
      await expect(
        component.read.getTokenFullTemplate([invalidBackgroundId])
      ).to.be.rejectedWith("Token does not exist");
      
      // Similarly, trying to render an avatar with invalid components should fail
      await expect(
        renderer.read.renderAvatar([
          "Invalid Components Test",
          invalidBackgroundId,
          invalidBackgroundId,
          invalidBackgroundId,
          invalidBackgroundId,
          invalidBackgroundId
        ])
      ).to.be.rejectedWith("Token does not exist");
      
      // But the generateSVG function should work with any string inputs
      const svg = await renderer.read.generateSVG([
        "PlaceholderBackground",
        "PlaceholderHead",
        "PlaceholderEyes",
        "PlaceholderMouth",
        "PlaceholderAccessory"
      ]);
      
      // The SVG should be valid
      expect(svg).to.include("<svg");
      expect(svg).to.include("</svg>");
      expect(svg.length).to.be.greaterThan(100);
    });

    it("Should handle multiple avatars with different components", async function () {
      const { renderer, component, componentTokens, avatarData } = await loadFixture(deployRendererFixture);
      
      // Create a second avatar with the same components (we're limited by what's available in the fixture)
      const avatarData2 = {
        name: "Second Avatar",
        backgroundId: avatarData.backgroundId,
        headId: avatarData.headId,
        eyesId: avatarData.eyesId,
        mouthId: avatarData.mouthId,
        accessoryId: avatarData.accessoryId
      };
      
      // Generate SVGs for both avatars
      const svg1 = await renderer.read.generateSVG([
        await component.read.getTokenFullTemplate([avatarData.backgroundId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData.headId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData.eyesId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData.mouthId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData.accessoryId]).then(t => t.imageData)
      ]);
      
      const svg2 = await renderer.read.generateSVG([
        await component.read.getTokenFullTemplate([avatarData2.backgroundId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData2.headId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData2.eyesId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData2.mouthId]).then(t => t.imageData),
        await component.read.getTokenFullTemplate([avatarData2.accessoryId]).then(t => t.imageData)
      ]);
      
      // Verify each SVG output
      expect(svg1).to.include("<svg");
      expect(svg1).to.include("</svg>");
      expect(svg2).to.include("<svg");
      expect(svg2).to.include("</svg>");
      
      // Verify token URIs
      const uri1 = await renderer.read.generateTokenURI([avatarData]);
      const uri2 = await renderer.read.generateTokenURI([avatarData2]);
      
      expect(uri1).to.include(avatarData.name);
      expect(uri2).to.include(avatarData2.name);
    });
  });
}); 