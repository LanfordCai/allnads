// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AllNadsComponent.sol";
import "./lib/SmallSolady.sol";

contract AllNadsRenderer is Ownable {
    using Strings for uint256;
    // Reference to the component contract
    AllNadsComponent public componentContract;

    string constant PNG_HEADER = "iVBORw0KGgoAAAANSUhEUgAA";
    string public defaultBodyData;

    struct AvatarData {
        string name;
        uint256 backgroundId;
        uint256 headId;
        uint256 eyesId;
        uint256 mouthId;
        uint256 accessoryId;
    }

    constructor(address _componentContract, string memory _defaultBodyData) Ownable(msg.sender) {
        componentContract = AllNadsComponent(_componentContract);
        defaultBodyData = _defaultBodyData;
    }

    function setComponentContract(address _componentContract) external onlyOwner {
        componentContract = AllNadsComponent(_componentContract);
    }

    function setDefaultBodyData(string memory _defaultBodyData) external onlyOwner {
        defaultBodyData = _defaultBodyData;
    }

    function generateTokenURI(AvatarData memory avatar) external view returns (string memory) {
        // 使用单次调用获取组件数据
        AllNadsComponent.Template memory bg = componentContract.getTokenFullTemplate(avatar.backgroundId);
        AllNadsComponent.Template memory head = componentContract.getTokenFullTemplate(avatar.headId);
        AllNadsComponent.Template memory eyes = componentContract.getTokenFullTemplate(avatar.eyesId);
        AllNadsComponent.Template memory mouth = componentContract.getTokenFullTemplate(avatar.mouthId);
        AllNadsComponent.Template memory accessory = componentContract.getTokenFullTemplate(avatar.accessoryId);

        string memory svg = generateSVG(bg.imageData, head.imageData, eyes.imageData, mouth.imageData, accessory.imageData);
        
        return formatJSON(avatar, svg);
    }

    function generateSVG(
        string memory backgroundUri,
        string memory headUri,
        string memory eyesUri,
        string memory mouthUri,
        string memory accessoryUri
    ) public view returns (string memory) {
        return string(abi.encodePacked(
            '<svg viewBox="0 0 72 72" width="256" height="256" xmlns="http://www.w3.org/2000/svg">',
            generateImageLayer(backgroundUri),
            generateImageLayer(defaultBodyData),
            generateImageLayer(headUri),
            generateImageLayer(eyesUri),
            generateImageLayer(mouthUri),
            generateImageLayer(accessoryUri),
            '</svg>'
        ));
    }

    function generateImageLayer(string memory imageUri) internal pure returns (string memory) {
        return string(abi.encodePacked(
            '<foreignObject x="0" y="0" width="100%" height="100%">',
            '<div xmlns="http://www.w3.org/1999/xhtml">',
            '<img width="100%" height="100%" src="data:image/png;base64,', 
            PNG_HEADER,
            imageUri,
            '" alt="Layer" />',
            '</div>',
            '</foreignObject>'
        ));
    }

    function formatJSON(AvatarData memory avatar, string memory svg) public pure returns (string memory) {
        // Base64 encode the SVG using Solady's implementation
        string memory base64EncodedSvg = string(
            abi.encodePacked(
                "data:image/svg+xml;base64,",
                SmallSolady.encode(bytes(svg))
            )
        );

        return string(abi.encodePacked(
            'data:application/json,{"name":"',
            avatar.name,
            '", "description":"AllNads Avatar NFT", ',
            '"image": "', base64EncodedSvg, '",',
            '"attributes":[',
            '{"trait_type":"Background","value":"', avatar.backgroundId.toString(), '"},',
            '{"trait_type":"Head","value":"', avatar.headId.toString(), '"},',
            '{"trait_type":"Eyes","value":"', avatar.eyesId.toString(), '"},',
            '{"trait_type":"Mouth","value":"', avatar.mouthId.toString(), '"},',
            '{"trait_type":"Accessory","value":"', avatar.accessoryId.toString(), '"}',
            ']}'
        ));
    }
} 