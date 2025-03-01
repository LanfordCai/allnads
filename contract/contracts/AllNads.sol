// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "./AllNadsComponent.sol";

interface IERC6551Registry {
    event AccountCreated(
        address account,
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    );

    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address);

    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address);
}

// Interface for AllNadsAccount
interface IAllNadsAccount {
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable returns (bytes memory);
}

// Interface for AllNadsRenderer
interface IAllNadsRenderer {
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

contract AllNads is ERC721Enumerable, Ownable, ERC1155Holder {
    using Strings for uint256;

    // ERC6551 Registry address - this is the standard registry contract that creates token bound accounts
    IERC6551Registry public immutable registry;
    
    // ERC6551 Account implementation address - this is the contract that will be deployed for each NFT
    address public immutable accountImplementation;
    
    // Renderer contract address
    address public rendererContract;
    
    // Component contract
    AllNadsComponent public immutable componentContract;
    
    // Next token ID counter (starting from 1)
    uint256 private _nextTokenId = 1;
    
    // Avatar struct to store avatar data with fixed component types
    struct Avatar {
        string name;
        uint256 backgroundId;
        uint256 hairstyleId;
        uint256 eyesId;
        uint256 mouthId;
        uint256 accessoryId;
    }
    
    // Mapping from token ID to Avatar
    mapping(uint256 => Avatar) private _avatars;
    
    // Events
    event AvatarMinted(
        address indexed to, 
        uint256 indexed tokenId,
        uint256 backgroundId,
        uint256 hairstyleId,
        uint256 eyesId,
        uint256 mouthId,
        uint256 accessoryId
    );
    event AvatarNameUpdated(uint256 indexed tokenId, string newName);
    event AccountCreated(address indexed account, uint256 indexed tokenId);
    event ComponentChanged(uint256 indexed tokenId, AllNadsComponent.ComponentType componentType, uint256 newComponentId);
    event RendererSet(address indexed renderer);

    constructor(
        string memory _name, 
        string memory _symbol,
        address _registry,
        address _accountImplementation,
        address _componentContract
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        registry = IERC6551Registry(_registry);
        accountImplementation = _accountImplementation;
        componentContract = AllNadsComponent(_componentContract);
    }
    
    /**
     * @notice Set the renderer contract address
     * @param _rendererContract Renderer contract address
     */
    function setRendererContract(address _rendererContract) external onlyOwner {
        rendererContract = _rendererContract;
        emit RendererSet(_rendererContract);
    }
    
    /**
     * @notice Validate component templates
     * @param _backgroundTemplateId Background template ID
     * @param _hairstyleTemplateId Hairstyle template ID
     * @param _eyesTemplateId Eyes template ID
     * @param _mouthTemplateId Mouth template ID
     * @param _accessoryTemplateId Accessory template ID
     * @return Whether all components are valid
     */
    function validateComponents(
        uint256 _backgroundTemplateId,
        uint256 _hairstyleTemplateId,
        uint256 _eyesTemplateId,
        uint256 _mouthTemplateId,
        uint256 _accessoryTemplateId
    ) public view returns (bool) {
        // Verify component types match and templates are active
        try componentContract.getTemplate(_backgroundTemplateId) returns (
            AllNadsComponent.Template memory template
        ) {
            if (!template.isActive) return false;
            if (componentContract.getTemplateType(_backgroundTemplateId) != AllNadsComponent.ComponentType.BACKGROUND) 
                return false;
        } catch {
            return false;
        }
        
        try componentContract.getTemplate(_hairstyleTemplateId) returns (
            AllNadsComponent.Template memory template
        ) {
            if (!template.isActive) return false;
            if (componentContract.getTemplateType(_hairstyleTemplateId) != AllNadsComponent.ComponentType.HAIRSTYLE) 
                return false;
        } catch {
            return false;
        }
        
        try componentContract.getTemplate(_eyesTemplateId) returns (
            AllNadsComponent.Template memory template
        ) {
            if (!template.isActive) return false;
            if (componentContract.getTemplateType(_eyesTemplateId) != AllNadsComponent.ComponentType.EYES) 
                return false;
        } catch {
            return false;
        }
        
        try componentContract.getTemplate(_mouthTemplateId) returns (
            AllNadsComponent.Template memory template
        ) {
            if (!template.isActive) return false;
            if (componentContract.getTemplateType(_mouthTemplateId) != AllNadsComponent.ComponentType.MOUTH) 
                return false;
        } catch {
            return false;
        }
        
        try componentContract.getTemplate(_accessoryTemplateId) returns (
            AllNadsComponent.Template memory template
        ) {
            if (!template.isActive) return false;
            if (componentContract.getTemplateType(_accessoryTemplateId) != AllNadsComponent.ComponentType.ACCESSORY) 
                return false;
        } catch {
            return false;
        }
        
        return true;
    }
    
    /**
     * @notice Calculate total cost of minting components
     * @param _backgroundTemplateId Background template ID
     * @param _hairstyleTemplateId Hairstyle template ID
     * @param _eyesTemplateId Eyes template ID
     * @param _mouthTemplateId Mouth template ID
     * @param _accessoryTemplateId Accessory template ID
     * @return Total cost
     */
    function calculateTotalCost(
        uint256 _backgroundTemplateId,
        uint256 _hairstyleTemplateId,
        uint256 _eyesTemplateId,
        uint256 _mouthTemplateId,
        uint256 _accessoryTemplateId
    ) public view returns (uint256) {
        AllNadsComponent.Template memory backgroundTemplate = componentContract.getTemplate(_backgroundTemplateId);
        AllNadsComponent.Template memory hairstyleTemplate = componentContract.getTemplate(_hairstyleTemplateId);
        AllNadsComponent.Template memory eyesTemplate = componentContract.getTemplate(_eyesTemplateId);
        AllNadsComponent.Template memory mouthTemplate = componentContract.getTemplate(_mouthTemplateId);
        AllNadsComponent.Template memory accessoryTemplate = componentContract.getTemplate(_accessoryTemplateId);
        
        return backgroundTemplate.price + hairstyleTemplate.price + eyesTemplate.price + mouthTemplate.price + accessoryTemplate.price;
    }
    
    /**
     * @notice Mint an avatar with fixed component types
     * @param _name Name for the avatar
     * @param _backgroundTemplateId Background template ID
     * @param _hairstyleTemplateId Hairstyle template ID
     * @param _eyesTemplateId Eyes template ID
     * @param _mouthTemplateId Mouth template ID
     * @param _accessoryTemplateId Accessory template ID
     */
    function mint(
        string memory _name,
        uint256 _backgroundTemplateId,
        uint256 _hairstyleTemplateId,
        uint256 _eyesTemplateId,
        uint256 _mouthTemplateId,
        uint256 _accessoryTemplateId
    ) external payable {
        // Validate all components
        require(validateComponents(
            _backgroundTemplateId,
            _hairstyleTemplateId,
            _eyesTemplateId,
            _mouthTemplateId,
            _accessoryTemplateId
        ), "Invalid or inactive components");
        
        // Calculate total cost
        uint256 totalPrice = calculateTotalCost(
            _backgroundTemplateId,
            _hairstyleTemplateId,
            _eyesTemplateId,
            _mouthTemplateId,
            _accessoryTemplateId
        );
        
        require(msg.value >= totalPrice, "Insufficient payment");
        
        // Mint the avatar NFT
        uint256 tokenId = _nextTokenId;
        _nextTokenId += 1;
        
        _safeMint(msg.sender, tokenId);
        
        // Create ERC6551 account for the NFT
        address account = _createAccount(tokenId);
        
        // Create array of template IDs
        uint256[] memory templateIds = new uint256[](5);
        templateIds[0] = _backgroundTemplateId;
        templateIds[1] = _hairstyleTemplateId;
        templateIds[2] = _eyesTemplateId;
        templateIds[3] = _mouthTemplateId;
        templateIds[4] = _accessoryTemplateId;
        
        // Mint components and send them to the avatar's account
        uint256[] memory componentIds = componentContract.mintComponents{value: totalPrice}(
            templateIds, 
            account
        );
        
        // Initialize avatar with components
        _avatars[tokenId] = Avatar({
            name: _name,
            backgroundId: componentIds[0],
            hairstyleId: componentIds[1],
            eyesId: componentIds[2],
            mouthId: componentIds[3],
            accessoryId: componentIds[4]
        });
        
        // Mark all components as equipped
        for (uint256 i = 0; i < componentIds.length; i++) {
            componentContract.setEquippedStatus(componentIds[i], true);
        }
        
        // Refund excess payment
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }
        
        emit AvatarMinted(
            msg.sender, 
            tokenId,
            componentIds[0],
            componentIds[1],
            componentIds[2],
            componentIds[3],
            componentIds[4]
        );
        emit AccountCreated(account, tokenId);
    }
    
    /**
     * @notice Change a component of an avatar
     * @param tokenId Avatar token ID
     * @param componentId Existing component token ID owned by the avatar's TBA
     * @param componentType Type of component to change
     */
    function changeComponent(
        uint256 tokenId,
        uint256 componentId,
        AllNadsComponent.ComponentType componentType
    ) external {
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId), "Not authorized");
        
        // Get the token bound account for the avatar
        address account = accountForToken(tokenId);
        
        // Check if the TBA owns this component
        require(IERC1155(address(componentContract)).balanceOf(account, componentId) > 0, "TBA does not own this component");
        
        // Verify component template exists and get its type
        uint256 templateId = componentContract.getTokenTemplate(componentId);
        AllNadsComponent.Template memory template = componentContract.getTemplate(templateId);
        
        // Check component type
        require(template.componentType == componentType, "Component type mismatch");
        
        // Get the current component ID for this type
        Avatar storage avatar = _avatars[tokenId];
        uint256 oldComponentId = 0;
        
        if (componentType == AllNadsComponent.ComponentType.BACKGROUND) {
            oldComponentId = avatar.backgroundId;
            avatar.backgroundId = componentId;
        } else if (componentType == AllNadsComponent.ComponentType.HAIRSTYLE) {
            oldComponentId = avatar.hairstyleId;
            avatar.hairstyleId = componentId;
        } else if (componentType == AllNadsComponent.ComponentType.EYES) {
            oldComponentId = avatar.eyesId;
            avatar.eyesId = componentId;
        } else if (componentType == AllNadsComponent.ComponentType.MOUTH) {
            oldComponentId = avatar.mouthId;
            avatar.mouthId = componentId;
        } else if (componentType == AllNadsComponent.ComponentType.ACCESSORY) {
            oldComponentId = avatar.accessoryId;
            avatar.accessoryId = componentId;
        }
        
        // If there was an old component, mark it as unequipped
        if (oldComponentId > 0) {
            componentContract.setEquippedStatus(oldComponentId, false);
        }
        
        // Mark the new component as equipped
        componentContract.setEquippedStatus(componentId, true);
        
        emit ComponentChanged(tokenId, componentType, componentId);
    }
    
    /**
     * @notice Change multiple components of an avatar
     * @param tokenId Avatar token ID
     * @param backgroundId New background component ID (0 to keep existing)
     * @param hairstyleId New hairstyle component ID (0 to keep existing)
     * @param eyesId New eyes component ID (0 to keep existing)
     * @param mouthId New mouth component ID (0 to keep existing)
     * @param accessoryId New accessory component ID (0 to keep existing)
     */
    function changeComponents(
        uint256 tokenId,
        uint256 backgroundId,
        uint256 hairstyleId,
        uint256 eyesId,
        uint256 mouthId,
        uint256 accessoryId
    ) external {
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId), "Not authorized");
        
        // Change components by calling changeComponent for each non-zero ID
        if (backgroundId > 0) {
            this.changeComponent(tokenId, backgroundId, AllNadsComponent.ComponentType.BACKGROUND);
        }
        
        if (hairstyleId > 0) {
            this.changeComponent(tokenId, hairstyleId, AllNadsComponent.ComponentType.HAIRSTYLE);
        }
        
        if (eyesId > 0) {
            this.changeComponent(tokenId, eyesId, AllNadsComponent.ComponentType.EYES);
        }
        
        if (mouthId > 0) {
            this.changeComponent(tokenId, mouthId, AllNadsComponent.ComponentType.MOUTH);
        }
        
        if (accessoryId > 0) {
            this.changeComponent(tokenId, accessoryId, AllNadsComponent.ComponentType.ACCESSORY);
        }
    }
    
    // Create token bound account for an NFT
    function _createAccount(uint256 tokenId) internal returns (address) {
        return registry.createAccount(
            accountImplementation,
            block.chainid,
            address(this),
            tokenId,
            0, // salt
            "" // no initialization data
        );
    }
    
    // Get the token bound account address for an NFT
    function accountForToken(uint256 tokenId) public view returns (address) {
        return registry.account(
            accountImplementation,
            block.chainid,
            address(this),
            tokenId,
            0 // salt
        );
    }
    
    // Update avatar name
    function updateName(uint256 tokenId, string memory newName) external {
        require(_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId), "Not authorized");
        
        _avatars[tokenId].name = newName;
        emit AvatarNameUpdated(tokenId, newName);
    }
    
    // Get avatar details
    function getAvatar(uint256 tokenId) external view returns (Avatar memory) {
        require(_exists(tokenId), "Token does not exist");
        return _avatars[tokenId];
    }
    
    // Get all component IDs for an avatar
    function getAvatarComponents(uint256 tokenId) external view returns (uint256[] memory) {
        require(_exists(tokenId), "Token does not exist");
        Avatar memory avatar = _avatars[tokenId];
        
        uint256[] memory components = new uint256[](5);
        components[0] = avatar.backgroundId;
        components[1] = avatar.hairstyleId;
        components[2] = avatar.eyesId;
        components[3] = avatar.mouthId;
        components[4] = avatar.accessoryId;
        
        return components;
    }
    
    // Override tokenURI function to use the renderer
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        require(rendererContract != address(0), "Renderer not set");
        
        return IAllNadsRenderer(rendererContract).tokenURI(tokenId);
    }
    
    // Withdraw funds
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    // Required override for ERC721Enumerable and ERC1155Holder
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Enumerable, ERC1155Holder)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Returns whether the specified token exists.
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
