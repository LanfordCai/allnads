// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./AllNadsComponent.sol";

/**
 * @title AllNadsComponentQuery
 * @notice Helper contract to batch query template ownership from AllNadsComponent
 * @dev This contract provides utility functions to check which templates an address owns
 */
contract AllNadsComponentQuery {
    // Reference to the AllNadsComponent contract
    AllNadsComponent public componentContract;
    
    /**
     * @notice Constructor
     * @param _componentContract Address of the AllNadsComponent contract
     */
    constructor(address _componentContract) {
        componentContract = AllNadsComponent(_componentContract);
    }
    
    /**
     * @notice Batch check which templates an address owns
     * @param owner The address to check
     * @param templateIds Array of template IDs to check
     * @return ownedTemplates Array of booleans indicating ownership status
     * @return tokenIds Array of token IDs for owned templates (0 if not owned)
     */
    function batchCheckTemplateOwnership(
        address owner, 
        uint256[] calldata templateIds
    ) external view returns (bool[] memory ownedTemplates, uint256[] memory tokenIds) {
        ownedTemplates = new bool[](templateIds.length);
        tokenIds = new uint256[](templateIds.length);
        
        for (uint256 i = 0; i < templateIds.length; i++) {
            try componentContract.getAddressTemplateToken(owner, templateIds[i]) returns (uint256 tokenId) {
                ownedTemplates[i] = true;
                tokenIds[i] = tokenId;
            } catch {
                ownedTemplates[i] = false;
                tokenIds[i] = 0;
            }
        }
        
        return (ownedTemplates, tokenIds);
    }
    
    /**
     * @notice Get all owned templates by type
     * @param owner The address to check
     * @param componentType The component type to check
     * @return ownedTemplateIds Array of owned template IDs
     * @return ownedTokenIds Array of corresponding token IDs
     */
    function getOwnedTemplatesByType(
        address owner,
        AllNadsComponent.ComponentType componentType
    ) external view returns (uint256[] memory ownedTemplateIds, uint256[] memory ownedTokenIds) {
        // Get all templates of this type
        uint256[] memory allTemplateIds = componentContract.getTemplatesByType(componentType);
        
        // Count owned templates first to size the arrays correctly
        uint256 ownedCount = 0;
        bool[] memory tempOwned = new bool[](allTemplateIds.length);
        uint256[] memory tempTokenIds = new uint256[](allTemplateIds.length);
        
        for (uint256 i = 0; i < allTemplateIds.length; i++) {
            try componentContract.getAddressTemplateToken(owner, allTemplateIds[i]) returns (uint256 tokenId) {
                tempOwned[i] = true;
                tempTokenIds[i] = tokenId;
                ownedCount++;
            } catch {
                tempOwned[i] = false;
                tempTokenIds[i] = 0;
            }
        }
        
        // Create properly sized result arrays
        ownedTemplateIds = new uint256[](ownedCount);
        ownedTokenIds = new uint256[](ownedCount);
        
        // Fill result arrays
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < allTemplateIds.length; i++) {
            if (tempOwned[i]) {
                ownedTemplateIds[resultIndex] = allTemplateIds[i];
                ownedTokenIds[resultIndex] = tempTokenIds[i];
                resultIndex++;
            }
        }
        
        return (ownedTemplateIds, ownedTokenIds);
    }
    
    /**
     * @notice Get all owned templates across all types
     * @param owner The address to check
     * @return ownedTemplateIds Array of owned template IDs
     * @return templateTypes Array of corresponding component types
     * @return tokenIds Array of corresponding token IDs
     */
    function getAllOwnedTemplates(
        address owner
    ) external view returns (
        uint256[] memory ownedTemplateIds,
        AllNadsComponent.ComponentType[] memory templateTypes,
        uint256[] memory tokenIds
    ) {
        // Get the next template ID to know how many templates exist
        uint256 templateCount = componentContract.nextTemplateId() - 1;
        
        // Count owned templates first to size the arrays correctly
        uint256 ownedCount = 0;
        bool[] memory tempOwned = new bool[](templateCount);
        AllNadsComponent.ComponentType[] memory tempTypes = new AllNadsComponent.ComponentType[](templateCount);
        uint256[] memory tempTokenIds = new uint256[](templateCount);
        
        for (uint256 templateId = 1; templateId <= templateCount; templateId++) {
            try componentContract.getAddressTemplateToken(owner, templateId) returns (uint256 tokenId) {
                tempOwned[templateId - 1] = true;
                tempTokenIds[templateId - 1] = tokenId;
                
                // Get the component type
                try componentContract.getTemplateType(templateId) returns (AllNadsComponent.ComponentType componentType) {
                    tempTypes[templateId - 1] = componentType;
                } catch {
                    // Skip if we can't get the type (template might not exist)
                    tempOwned[templateId - 1] = false;
                    continue;
                }
                
                ownedCount++;
            } catch {
                tempOwned[templateId - 1] = false;
            }
        }
        
        // Create properly sized result arrays
        ownedTemplateIds = new uint256[](ownedCount);
        templateTypes = new AllNadsComponent.ComponentType[](ownedCount);
        tokenIds = new uint256[](ownedCount);
        
        // Fill result arrays
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < templateCount; i++) {
            if (tempOwned[i]) {
                ownedTemplateIds[resultIndex] = i + 1; // templateId = index + 1
                templateTypes[resultIndex] = tempTypes[i];
                tokenIds[resultIndex] = tempTokenIds[i];
                resultIndex++;
            }
        }
        
        return (ownedTemplateIds, templateTypes, tokenIds);
    }
    
    /**
     * @notice Get a summary of owned templates by type
     * @param owner The address to check
     * @return counts Array of counts for each component type
     */
    function getOwnedTemplateCounts(address owner) external view returns (uint256[] memory counts) {
        counts = new uint256[](5); // 5 component types
        
        // 初始化所有计数为0
        for (uint8 i = 0; i < 5; i++) {
            counts[i] = 0;
        }
        
        for (uint8 typeIndex = 0; typeIndex < 5; typeIndex++) {
            AllNadsComponent.ComponentType componentType = AllNadsComponent.ComponentType(typeIndex);
            uint256[] memory templateIds = componentContract.getTemplatesByType(componentType);
            
            for (uint256 i = 0; i < templateIds.length; i++) {
                try componentContract.getAddressTemplateToken(owner, templateIds[i]) returns (uint256) {
                    counts[typeIndex]++;
                } catch {
                    // Not owned, do nothing
                }
            }
        }
        
        return counts;
    }
} 