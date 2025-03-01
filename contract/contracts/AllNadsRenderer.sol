// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./lib/SmallSolady.sol";
import "./AllNadsComponent.sol";
import "./AllNads.sol";

/**
 * @title AllNadsRenderer
 * @notice Handles on-chain generation of metadata and rendering for AllNads avatars
 * @dev This contract is responsible for generating the metadata and SVG for AllNads avatars
 */
contract AllNadsRenderer is Ownable {
    using Strings for uint256;

    // Reference to the AllNads avatar contract
    AllNads public allNadsContract;
    
    // Reference to the component contract
    AllNadsComponent public componentContract;
    
    // Default body image data (Base64 encoded)
    string public defaultBodyData;

    /**
     * @notice Constructor for AllNadsRenderer
     * @param _defaultBodyData Default body image data (Base64 encoded)
     */
    constructor(string memory _defaultBodyData) Ownable(msg.sender) {
        defaultBodyData = _defaultBodyData;
    }

    /**
     * @notice Set the avatar and component contracts
     * @param _allNadsContract AllNads contract address
     * @param _componentContract AllNadsComponent contract address
     */
    function setContracts(address _allNadsContract, address _componentContract) external onlyOwner {
        allNadsContract = AllNads(_allNadsContract);
        componentContract = AllNadsComponent(_componentContract);
    }

    /**
     * @notice Update the default body data
     * @param _defaultBodyData New default body data (Base64 encoded)
     */
    function setDefaultBodyData(string memory _defaultBodyData) external onlyOwner {
        defaultBodyData = _defaultBodyData;
    }

    /**
     * @notice Generate metadata for a token
     * @param _tokenId Token ID to generate metadata for
     * @return Metadata JSON for the token
     */
    function tokenURI(uint256 _tokenId) external view returns (string memory) {
        AllNads.Avatar memory avatar = allNadsContract.getAvatar(_tokenId);
        
        // Generate SVG directly
        string memory svgData = generateSVG(_tokenId, avatar);
        
        // Get the account address for this token
        address accountAddress = allNadsContract.accountForToken(_tokenId);
        
        // Base64 encode the SVG
        string memory encodedSVG = SmallSolady.encode(bytes(svgData));
        
        // Build the JSON metadata
        bytes memory jsonData = abi.encodePacked(
            '{"name":"AllNads #',
            _tokenId.toString(),
            '", "description":"AllNads Avatar NFT with ERC6551 Token Bound Account", ',
            '"image":"data:image/svg+xml;base64,',
            encodedSVG,
            '", ',
            '"attributes":[',
            '{"trait_type":"Name","value":"',
            avatar.name,
            '"},',
            '{"trait_type":"Token Bound Account","value":"',
            addressToString(accountAddress),
            '"}'
        );
        
        // Add component traits
        jsonData = abi.encodePacked(
            jsonData,
            getComponentAttributes(avatar),
            ']}'
        );
        
        return string(
            abi.encodePacked(
                "data:application/json,",
                jsonData
            )
        );
    }

    /**
     * @notice Generate SVG for a token
     * @param _tokenId Token ID to generate SVG for
     * @param _avatar Avatar struct for the token
     * @return SVG for the token
     */
    function generateSVG(uint256 _tokenId, AllNads.Avatar memory _avatar) public view returns (string memory) {
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="500" height="500">',
            '<style>',
            '.avatar { image-rendering: pixelated; image-rendering: crisp-edges; }',
            '</style>'
        );
        
        // Add background (directly using backgroundId from avatar)
        svg = abi.encodePacked(
            svg,
            generateImageLayer(componentContract.getTokenTemplate(_avatar.backgroundId))
        );
        
        // Add default body
        svg = abi.encodePacked(
            svg,
            '<image class="avatar" x="0" y="0" width="72" height="72" href="data:image/png;base64,',
            defaultBodyData,
            '" />'
        );
        
        // Add the rest of the components in order (directly using fields from avatar)
        svg = abi.encodePacked(
            svg,
            generateImageLayer(componentContract.getTokenTemplate(_avatar.hairstyleId))
        );
        
        svg = abi.encodePacked(
            svg,
            generateImageLayer(componentContract.getTokenTemplate(_avatar.eyesId))
        );
        
        svg = abi.encodePacked(
            svg,
            generateImageLayer(componentContract.getTokenTemplate(_avatar.mouthId))
        );
        
        svg = abi.encodePacked(
            svg,
            generateImageLayer(componentContract.getTokenTemplate(_avatar.accessoryId))
        );
        
        // Close the SVG
        svg = abi.encodePacked(svg, '</svg>');
        
        return string(svg);
    }

    /**
     * @notice Generate an image layer for a component
     * @param _templateId Template ID for the component
     * @return SVG fragment for the component
     */
    function generateImageLayer(uint256 _templateId) internal view returns (string memory) {
        AllNadsComponent.Template memory template = componentContract.getTemplate(_templateId);
        
        return string(abi.encodePacked(
            '<image class="avatar" x="0" y="0" width="72" height="72" href="data:image/png;base64,',
            template.imageData,
            '" />'
        ));
    }

    /**
     * @notice Get JSON attributes for components
     * @param _avatar Avatar struct containing component IDs
     * @return JSON attributes string for the components
     */
    function getComponentAttributes(AllNads.Avatar memory _avatar) internal view returns (string memory) {
        bytes memory attributes = "";
        
        // Add background component attribute
        uint256 bgTemplateId = componentContract.getTokenTemplate(_avatar.backgroundId);
        AllNadsComponent.Template memory bgTemplate = componentContract.getTemplate(bgTemplateId);
        attributes = abi.encodePacked(
            attributes,
            '{"trait_type":"Background","value":"',
            bgTemplate.name,
            '"}'
        );
        
        // Add hairstyle component attribute
        uint256 hairstyleTemplateId = componentContract.getTokenTemplate(_avatar.hairstyleId);
        AllNadsComponent.Template memory hairstyleTemplate = componentContract.getTemplate(hairstyleTemplateId);
        attributes = abi.encodePacked(
            attributes,
            ',{"trait_type":"Hairstyle","value":"',
            hairstyleTemplate.name,
            '"}'
        );
        
        // Add eyes component attribute
        uint256 eyesTemplateId = componentContract.getTokenTemplate(_avatar.eyesId);
        AllNadsComponent.Template memory eyesTemplate = componentContract.getTemplate(eyesTemplateId);
        attributes = abi.encodePacked(
            attributes,
            ',{"trait_type":"Eyes","value":"',
            eyesTemplate.name,
            '"}'
        );
        
        // Add mouth component attribute
        uint256 mouthTemplateId = componentContract.getTokenTemplate(_avatar.mouthId);
        AllNadsComponent.Template memory mouthTemplate = componentContract.getTemplate(mouthTemplateId);
        attributes = abi.encodePacked(
            attributes,
            ',{"trait_type":"Mouth","value":"',
            mouthTemplate.name,
            '"}'
        );
        
        // Add accessory component attribute
        uint256 accessoryTemplateId = componentContract.getTokenTemplate(_avatar.accessoryId);
        AllNadsComponent.Template memory accessoryTemplate = componentContract.getTemplate(accessoryTemplateId);
        attributes = abi.encodePacked(
            attributes,
            ',{"trait_type":"Accessory","value":"',
            accessoryTemplate.name,
            '"}'
        );
        
        return string(attributes);
    }

    /**
     * @notice Convert address to string
     * @param _address Address to convert
     * @return String representation of the address
     */
    function addressToString(address _address) internal pure returns (string memory) {
        return Strings.toHexString(uint160(_address), 20);
    }
} 