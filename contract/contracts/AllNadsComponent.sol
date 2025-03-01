// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./lib/SmallSolady.sol";

/**
 * @title AllNadsComponent
 * @notice ERC1155 contract for AllNads avatar components
 * @dev This contract manages all the component NFTs that can be owned by AllNads avatars
 */
contract AllNadsComponent is ERC1155, Ownable {
    using Strings for uint256;

    // AllNads main contract address 
    address public allNadsContract;
    
    // Component types (updated to match the five fixed components)
    enum ComponentType {
        BACKGROUND,
        HAIRSTYLE,
        EYES,
        MOUTH,
        ACCESSORY
    }

    // PNG header constant used to save gas by not storing this standard prefix with each image
    // This is concatenated with the stored image data when serving the URI
    string constant PNG_HEADER = "iVBORw0KGgoAAAANSUhEUgAA";

    // Component template structure
    struct Template {
        string name;
        address creator;
        uint256 maxSupply;
        uint256 currentSupply;
        uint256 price;
        string imageData;  // Base64 encoded image data
        bool isActive;
        ComponentType componentType;
    }

    // Mapping from template ID to Template struct
    mapping(uint256 => Template) private _templates;
    
    // Next template ID
    uint256 public nextTemplateId = 1;
    
    // Next token ID
    uint256 public nextTokenId = 1;
    
    // Mapping from token ID to template ID
    mapping(uint256 => uint256) private _tokenTemplate;
    
    // Mapping from creator address to template IDs
    mapping(address => uint256[]) private _creatorTemplates;
    
    // Mapping from component type to template IDs
    mapping(ComponentType => uint256[]) private _templatesByType;
    
    // Creator royalty percentage (out of 100)
    uint256 public creatorRoyaltyPercentage = 80;
    
    // Fee for creating a new template
    uint256 public templateCreationFee = 0.01 ether;
    
    // Mapping to record equipped components
    mapping(uint256 => bool) private _isEquipped;
    
    // 记录地址拥有的特定模板的组件（地址 => 模板ID => 组件ID）
    mapping(address => mapping(uint256 => uint256)) private _addressTemplateToken;
    
    // 添加装备状态改变事件
    event ComponentEquipStatusChanged(uint256 indexed tokenId, bool equipped);
    
    // Events
    event TemplateCreated(uint256 indexed templateId, address indexed creator, ComponentType indexed componentType);
    event TemplateMinted(uint256 indexed templateId, address indexed minter, uint256 tokenId);
    event TemplatePriceUpdated(uint256 indexed templateId, uint256 newPrice);
    event TemplateStatusUpdated(uint256 indexed templateId, bool isActive);

    /**
     * @notice Modifier to restrict function access to template creator or contract owner
     * @param _templateId ID of the template
     */
    modifier onlyCreator(uint256 _templateId) {
        require(msg.sender == _templates[_templateId].creator, "Only creator can perform this action");
        _;
    }

    //------------------------------------------------------------------------
    // 1. 构造函数与初始化
    //------------------------------------------------------------------------

    /**
     * @notice 合约构造函数
     * @dev 初始化 ERC1155 并设置所有者
     */
    constructor() ERC1155("AllNads Component") Ownable(msg.sender) {
    }

    /**
     * @notice 设置 AllNads 主合约地址
     * @param _allNadsContract AllNads 合约地址
     * @dev 只能由合约所有者调用，且只能设置一次
     */
    function setAllNadsContract(address _allNadsContract) external onlyOwner {
        require(allNadsContract == address(0), "AllNads contract already set");
        allNadsContract = _allNadsContract;
    }

    //------------------------------------------------------------------------
    // 2. 模板管理函数
    //------------------------------------------------------------------------

    /**
     * @notice 创建新的组件模板
     * @param _name 模板名称
     * @param _maxSupply 模板最大供应量(0表示无限制)
     * @param _price 铸造此组件的价格
     * @param _imageData Base64编码的图像数据
     * @param _componentType 组件类型
     * @return templateId 新创建模板的ID
     * @dev 需支付模板创建费用
     */
    function createTemplate(
        string memory _name,
        uint256 _maxSupply,
        uint256 _price,
        string memory _imageData,
        ComponentType _componentType
    ) external payable returns (uint256) {
        require(msg.value == templateCreationFee, "Must pay template creation fee");
        
        // 移除图片数据中的 PNG 头部
        string memory cleanImageData = _removeHeader(_imageData);
        
        uint256 templateId = nextTemplateId++;
        
        _templates[templateId] = Template({
            name: _name,
            creator: msg.sender,
            maxSupply: _maxSupply,
            currentSupply: 0,
            price: _price,
            imageData: cleanImageData,
            isActive: true,
            componentType: _componentType
        });

        _creatorTemplates[msg.sender].push(templateId);
        _templatesByType[_componentType].push(templateId);

        // Send the template creation fee to the contract owner
        payable(owner()).transfer(templateCreationFee);
        
        emit TemplateCreated(templateId, msg.sender, _componentType);
        return templateId;
    }

    /**
     * @notice 更新模板价格
     * @param _templateId 要更新的模板ID
     * @param _newPrice 模板的新价格
     * @dev 只能由模板创建者调用
     */
    function updateTemplatePrice(uint256 _templateId, uint256 _newPrice) external onlyCreator(_templateId) {
        _templates[_templateId].price = _newPrice;
        emit TemplatePriceUpdated(_templateId, _newPrice);
    }

    /**
     * @notice 更新模板名称
     * @param _templateId 要更新的模板ID
     * @param _newName 模板的新名称
     * @dev 只能由模板创建者调用，且模板必须处于激活状态
     */
    function updateTemplateName(uint256 _templateId, string memory _newName) external onlyCreator(_templateId) {
        require(_templates[_templateId].isActive, "Template is not active");
        _templates[_templateId].name = _newName;
    }

    /**
     * @notice 更新模板最大供应量
     * @param _templateId 要更新的模板ID
     * @param _newMaxSupply 新的最大供应量
     * @dev 只能由模板创建者调用，且新供应量必须大于或等于当前供应量
     */
    function updateTemplateMaxSupply(uint256 _templateId, uint256 _newMaxSupply) external onlyCreator(_templateId) {
        Template storage template = _templates[_templateId];
        require(template.isActive, "Template is not active");
        require(_newMaxSupply >= template.currentSupply, "New max supply too low");
        template.maxSupply = _newMaxSupply;
    }

    /**
     * @notice 切换模板激活状态
     * @param _templateId 要切换状态的模板ID
     * @dev 只能由模板创建者调用
     */
    function toggleTemplateStatus(uint256 _templateId) external onlyCreator(_templateId) {
        _templates[_templateId].isActive = !_templates[_templateId].isActive;
        emit TemplateStatusUpdated(_templateId, _templates[_templateId].isActive);
    }

    /**
     * @notice 设置模板创建费用
     * @param _fee 新的模板创建费用
     * @dev 只能由合约所有者调用
     */
    function setTemplateCreationFee(uint256 _fee) external onlyOwner {
        templateCreationFee = _fee;
    }

    //------------------------------------------------------------------------
    // 3. 铸造与组件管理函数
    //------------------------------------------------------------------------

    /**
     * @notice 从模板铸造一个组件
     * @param _templateId 要铸造的模板ID
     * @param _to 接收铸造组件的地址
     * @return tokenId 新铸造的令牌ID
     * @dev 需支付模板设定的价格
     */
    function mintComponent(uint256 _templateId, address _to) external payable returns (uint256) {
        uint256[] memory templateIds = new uint256[](1);
        templateIds[0] = _templateId;
        
        uint256[] memory tokenIds = mintComponents(templateIds, _to);
        return tokenIds[0];
    }

    /**
     * @notice 从多个模板铸造组件
     * @param _templateIds 要铸造的模板ID数组
     * @param _to 接收铸造组件的地址
     * @return tokenIds 新铸造的令牌ID数组
     * @dev 需支付所有模板价格的总和
     */
    function mintComponents(uint256[] memory _templateIds, address _to) public payable returns (uint256[] memory) {
        uint256 totalPrice = 0;
        uint256[] memory tokenIds = new uint256[](_templateIds.length);
        
        // First validate all templates and calculate total price
        for (uint256 i = 0; i < _templateIds.length; i++) {
            Template storage template = _templates[_templateIds[i]];
            require(template.creator != address(0), "Template does not exist");
            require(template.isActive, "Template is not active");
            require(template.currentSupply < template.maxSupply, "Max supply reached");
            
            totalPrice += template.price;
        }
        
        require(msg.value == totalPrice, "Incorrect payment");
        
        // Then mint all tokens
        for (uint256 i = 0; i < _templateIds.length; i++) {
            uint256 templateId = _templateIds[i];
            Template storage template = _templates[templateId];
            
            uint256 tokenId = nextTokenId++;
            _tokenTemplate[tokenId] = templateId;
            tokenIds[i] = tokenId;
            
            template.currentSupply++;
            _mint(_to, tokenId, 1, "");
            
            // Distribute royalties for each component
            if (template.price > 0) {
                uint256 creatorShare = (template.price * creatorRoyaltyPercentage) / 100;
                payable(template.creator).transfer(creatorShare);
                // 将剩余部分转移给合约所有者
                payable(owner()).transfer(template.price - creatorShare);
            }
            
            emit TemplateMinted(templateId, _to, tokenId);
        }
        
        return tokenIds;
    }

    //------------------------------------------------------------------------
    // 4. 装备状态管理函数
    //------------------------------------------------------------------------

    /**
     * @notice 设置组件的装备状态
     * @param tokenId 组件令牌ID
     * @param equipped 组件是否被装备
     * @dev 只能由AllNads主合约调用
     */
    function setEquippedStatus(uint256 tokenId, bool equipped) external {
        require(msg.sender == allNadsContract, "Only AllNads contract can call");
        _isEquipped[tokenId] = equipped;
        emit ComponentEquipStatusChanged(tokenId, equipped);
    }

    //------------------------------------------------------------------------
    // 5. 管理员函数
    //------------------------------------------------------------------------

    /**
     * @notice 设置创建者版税百分比
     * @param _percentage 新的版税百分比(0-100)
     * @dev 只能由合约所有者调用
     */
    function setCreatorRoyaltyPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage <= 100, "Percentage must be <= 100");
        creatorRoyaltyPercentage = _percentage;
    }

    /**
     * @notice 从合约提取资金
     * @dev 只能由合约所有者调用，将合约余额转移给所有者
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner()).transfer(balance);
    }
    
    /**
     * @notice ERC1155必需的接口支持检查
     * @param interfaceId 要检查的接口ID
     * @return bool 是否支持该接口
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    //------------------------------------------------------------------------
    // 6. 查询函数
    //------------------------------------------------------------------------

    /**
     * @notice 获取模板详情
     * @param _templateId 要获取的模板ID
     * @return Template 包含模板详情的结构体
     */
    function getTemplate(uint256 _templateId) external view returns (Template memory) {
        require(_templates[_templateId].creator != address(0), "Template does not exist");
        return _templates[_templateId];
    }

    /**
     * @notice 获取特定创建者创建的模板
     * @param _creator 创建者地址
     * @return 创建者创建的模板ID数组
     */
    function getTemplatesByCreator(address _creator) external view returns (uint256[] memory) {
        return _creatorTemplates[_creator];
    }

    /**
     * @notice 按组件类型获取模板
     * @param _componentType 组件类型
     * @return 指定类型的模板ID数组
     */
    function getTemplatesByType(ComponentType _componentType) external view returns (uint256[] memory) {
        return _templatesByType[_componentType];
    }

    /**
     * @notice 获取令牌的模板ID
     * @param _tokenId 令牌ID
     * @return 该令牌对应的模板ID
     */
    function getTokenTemplate(uint256 _tokenId) external view returns (uint256) {
        require(_tokenTemplate[_tokenId] != 0, "Token does not exist");
        return _tokenTemplate[_tokenId];
    }

    /**
     * @notice 检查令牌是否存在
     * @param _tokenId 要检查的令牌ID
     * @return 令牌是否存在
     */
    function tokenExists(uint256 _tokenId) external view returns (bool) {
        return _tokenTemplate[_tokenId] != 0;
    }

    /**
     * @notice 从模板ID获取组件类型
     * @param _templateId 模板ID
     * @return 组件类型枚举值
     */
    function getTemplateType(uint256 _templateId) external view returns (ComponentType) {
        require(_templates[_templateId].creator != address(0), "Template does not exist");
        return _templates[_templateId].componentType;
    }

    /**
     * @notice 生成令牌的URI
     * @param _tokenId 令牌ID
     * @return URI字符串，包含令牌元数据
     * @dev 直接返回JSON形式而非Base64编码
     */
    function uri(uint256 _tokenId) public view virtual override returns (string memory) {
        uint256 templateId = _tokenTemplate[_tokenId];
        Template storage template = _templates[templateId];
        require(template.creator != address(0), "URI query for nonexistent token");
        
        bytes memory json = abi.encodePacked(
            '{"name":"AllNads ',
            getComponentTypeName(template.componentType),
            ' #',
            _tokenId.toString(),
            '", "description":"AllNads Component NFT", "image":"data:image/png;base64,',
            PNG_HEADER,
            template.imageData,
            '", "attributes":[{"trait_type":"Component Type","value":"',
            getComponentTypeName(template.componentType),
            '"}, {"trait_type":"Template ID","value":"',
            templateId.toString(),
            '"}, {"trait_type":"Creator","value":"',
            Strings.toHexString(template.creator),
            '"}, {"trait_type":"Max Supply","value":"',
            template.maxSupply.toString(),
            '"}, {"trait_type":"Current Supply","value":"',
            template.currentSupply.toString(),
            '"}]}'
        );

        // 使用直接 JSON 方式返回，不使用 Base64 编码
        return string(
            abi.encodePacked(
                "data:application/json,",
                json
            )
        );
    }
    
    /**
     * @notice 获取组件类型的名称
     * @param _type 组件类型枚举值
     * @return name 组件类型的字符串名称
     */
    function getComponentTypeName(ComponentType _type) public pure returns (string memory) {
        if (_type == ComponentType.BACKGROUND) return "Background";
        if (_type == ComponentType.HAIRSTYLE) return "Hairstyle";
        if (_type == ComponentType.EYES) return "Eyes";
        if (_type == ComponentType.MOUTH) return "Mouth";
        if (_type == ComponentType.ACCESSORY) return "Accessory";
        revert("Invalid component type");
    }
    
    /**
     * @notice 获取地址拥有的特定模板组件的令牌ID
     * @param _owner 拥有者地址
     * @param _templateId 模板ID
     * @return tokenId 该地址拥有的指定模板组件的令牌ID
     */
    function getAddressTemplateToken(address _owner, uint256 _templateId) external view returns (uint256) {
        uint256 tokenId = _addressTemplateToken[_owner][_templateId];
        require(tokenId != 0 && balanceOf(_owner, tokenId) > 0, "Address does not own this template");
        return tokenId;
    }
    
    /**
     * @notice 检查组件是否被装备
     * @param tokenId 组件令牌ID
     * @return 组件是否被装备
     */
    function isEquipped(uint256 tokenId) external view returns (bool) {
        return _isEquipped[tokenId];
    }

    /**
     * @notice 从Token ID直接获取完整的模板数据
     * @param tokenId 组件令牌ID
     * @return 模板完整数据
     */
    function getTokenFullTemplate(uint256 tokenId) external view returns (Template memory) {
        uint256 templateId = _tokenTemplate[tokenId];
        require(templateId != 0, "Token does not exist");
        return _templates[templateId];
    }

    //------------------------------------------------------------------------
    // 7. 内部辅助函数
    //------------------------------------------------------------------------
    
    /**
     * @notice 处理图像数据，移除PNG头部
     * @param _imageData 原始图像数据
     * @return 处理后的图像数据(如存在头部则移除)
     * @dev 内部函数，用于节省gas
     */
    function _removeHeader(string memory _imageData) internal pure returns (string memory) {
        bytes memory data = bytes(_imageData);
        bytes memory header = bytes(PNG_HEADER);
        
        if (data.length < header.length) {
            return _imageData;
        }
        
        bool hasHeader = true;
        for (uint i = 0; i < header.length; i++) {
            if (data[i] != header[i]) {
                hasHeader = false;
                break;
            }
        }
        
        if (!hasHeader) {
            return _imageData;
        }
        
        // Create new bytes array without header
        bytes memory result = new bytes(data.length - header.length);
        for (uint i = 0; i < result.length; i++) {
            result[i] = data[i + header.length];
        }
        
        return string(result);
    }
    
    /**
     * @notice 重写ERC1155的_update函数，防止转移已装备的组件
     * @param from 发送方地址
     * @param to 接收方地址
     * @param ids 令牌ID数组
     * @param values 令牌数量数组
     * @dev 在铸造、销毁和转移期间调用
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override {
        for (uint256 i = 0; i < ids.length; i++) {
            // 如果组件被装备，则禁止转移
            if (_isEquipped[ids[i]]) {
                revert("Cannot transfer equipped component");
            }
            
            // 更新 _addressTemplateToken 映射
            if (from != address(0)) { // 不是铸造
                uint256 templateId = _tokenTemplate[ids[i]];
                if (_addressTemplateToken[from][templateId] == ids[i]) {
                    delete _addressTemplateToken[from][templateId];
                }
            }
            
            if (to != address(0)) { // 不是销毁
                uint256 templateId = _tokenTemplate[ids[i]];
                _addressTemplateToken[to][templateId] = ids[i];
            }
        }
        
        super._update(from, to, ids, values);
    }
} 