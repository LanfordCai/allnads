// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./AllNads.sol";

contract AllNadsAirdropper is Ownable {
    // AllNads contract reference
    AllNads public immutable allNads;
    
    // Admin role mapping
    mapping(address => bool) public admins;
    
    // Events
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event AvatarAirdropped(
        address indexed to, 
        uint256 indexed tokenId,
        string name,
        uint256 backgroundId,
        uint256 hairstyleId,
        uint256 eyesId,
        uint256 mouthId,
        uint256 accessoryId
    );
    event RefundSent(address indexed to, uint256 amount);
    
    // Modifiers
    modifier onlyAdmin() {
        require(owner() == msg.sender || admins[msg.sender], "Not admin");
        _;
    }
    
    constructor(address _allNadsAddress) Ownable(msg.sender) {
        allNads = AllNads(_allNadsAddress);
    }
    
    /**
     * @notice Add an admin
     * @param admin Address to add as admin
     */
    function addAdmin(address admin) external onlyOwner {
        admins[admin] = true;
        emit AdminAdded(admin);
    }
    
    /**
     * @notice Remove an admin
     * @param admin Address to remove as admin
     */
    function removeAdmin(address admin) external onlyOwner {
        admins[admin] = false;
        emit AdminRemoved(admin);
    }
    
    /**
     * @notice Mint an avatar for a specific recipient
     * @param to Recipient address
     * @param name Name for the avatar
     * @param backgroundTemplateId Background template ID
     * @param hairstyleTemplateId Hairstyle template ID
     * @param eyesTemplateId Eyes template ID
     * @param mouthTemplateId Mouth template ID
     * @param accessoryTemplateId Accessory template ID
     */
    function mintTo(
        address to,
        string memory name,
        uint256 backgroundTemplateId,
        uint256 hairstyleTemplateId,
        uint256 eyesTemplateId,
        uint256 mouthTemplateId,
        uint256 accessoryTemplateId
    ) external payable onlyAdmin {
        // Calculate component cost
        uint256 componentPrice = allNads.calculateTotalCost(
            backgroundTemplateId,
            hairstyleTemplateId,
            eyesTemplateId,
            mouthTemplateId,
            accessoryTemplateId
        );
        
        // Calculate total price including mint fee
        uint256 totalPrice = allNads.getTotalPrice(componentPrice);
        
        require(msg.value >= totalPrice, "Insufficient payment");
        
        // Get the current tokenId (it will be the next one to be minted)
        uint256 nextTokenId = allNads.totalSupply() + 1;
        
        // Mint the NFT (this will mint it to this contract)
        allNads.mint{value: totalPrice}(
            name,
            backgroundTemplateId,
            hairstyleTemplateId,
            eyesTemplateId,
            mouthTemplateId,
            accessoryTemplateId
        );
        
        // Transfer the NFT to the recipient
        IERC721(address(allNads)).transferFrom(address(this), to, nextTokenId);
        
        // Get the component IDs to emit in the event
        uint256[] memory components = allNads.getAvatarComponents(nextTokenId);
        
        emit AvatarAirdropped(
            to, 
            nextTokenId,
            name,
            components[0], // backgroundId
            components[1], // hairstyleId
            components[2], // eyesId
            components[3], // mouthId
            components[4]  // accessoryId
        );
        
        // Refund excess payment if any
        uint256 excessAmount = msg.value - totalPrice;
        if (excessAmount > 0) {
            // Send refund to the caller
            (bool success, ) = payable(msg.sender).call{value: excessAmount}("");
            require(success, "Refund failed");
            emit RefundSent(msg.sender, excessAmount);
        }
    }
    
    /**
     * @dev The contract needs to be able to receive the NFT before transferring it
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    /**
     * @notice Withdraw ETH from the contract
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    /**
     * @dev Receive function to allow the contract to receive ETH
     */
    receive() external payable {}
} 