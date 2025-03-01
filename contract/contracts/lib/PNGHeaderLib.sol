// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PNGHeaderLib
 * @notice 处理 PNG 头部的库
 * @dev 这个库提供了处理 PNG 头部的辅助功能，用于节省存储空间
 */
library PNGHeaderLib {
    // PNG header constant used to save gas by not storing this standard prefix with each image
    // This is concatenated with the stored image data when serving the URI
    string public constant PNG_HEADER = "iVBORw0KGgoAAAANSUhEUgAA";
    
    /**
     * @notice 处理图像数据，移除PNG头部
     * @param _imageData 原始图像数据
     * @return 处理后的图像数据(如存在头部则移除)
     * @dev 用于节省gas
     */
    function removeHeader(string memory _imageData) public pure returns (string memory) {
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
} 