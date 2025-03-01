// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "./interfaces/IERC6551Account.sol";
import "./lib/Bytecode.sol";

/**
 * @title AllNadsAccount
 * @dev Token-bound account implementation for AllNads NFTs with support for ERC721, ERC1155, and ERC20 tokens
 */
contract AllNadsAccount is IERC165, IERC1271, IERC6551Account, IERC721Receiver, IERC1155Receiver {
    // Account nonce, incremented on each successful execution
    uint256 private _nonce;

    // Allows the account to receive ETH
    receive() external payable {}

    /**
     * @dev Executes a call from this account to a target address
     * @param to The target address
     * @param value The amount of ETH to send
     * @param data The calldata to send
     * @return result The bytes returned from the call
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        require(msg.sender == owner(), "Not token owner");

        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }

        _nonce++;
        emit TransactionExecuted(to, value, data);
    }

    /**
     * @dev Returns token information bound to this account
     * @return chainId The chainId of the token
     * @return tokenContract The token contract address
     * @return tokenId The token ID
     */
    function token()
        external
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        uint256 length = address(this).code.length;
        return
            abi.decode(
                Bytecode.codeAt(address(this), length - 0x60, length),
                (uint256, address, uint256)
            );
    }

    event LogCheckIsOwner(address sender, address owner, bool result);

    function checkIsOwner() external returns (bool) {
        bool result = msg.sender == owner();
        emit LogCheckIsOwner(msg.sender, owner(), result);
        return result;
    }

    /**
     * @dev Returns the owner of the token bound to this account
     * @return The address of the token owner
     */
    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = this
            .token();
        if (chainId != block.chainid) return address(0);

        return IERC721(tokenContract).ownerOf(tokenId);
    }

    /**
     * @dev Implements IERC165 interface detection
     * @param interfaceId The interface id to check
     * @return True if the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return (
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId
        );
    }

    /**
     * @dev Implements IERC1271 to validate signatures
     * @param hash The hash of the data to be signed
     * @param signature The signature to validate
     * @return magicValue The magic value to indicate if signature is valid
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view returns (bytes4 magicValue) {
        bool isValid = SignatureChecker.isValidSignatureNow(
            owner(),
            hash,
            signature
        );

        if (isValid) {
            return IERC1271.isValidSignature.selector;
        }

        return "";
    }

    /**
     * @dev Returns the current nonce of the account
     * @return The current nonce value
     */
    function nonce() external view override returns (uint256) {
        return _nonce;
    }

    /**
     * @dev Sends ETH from this account to a specified address
     * @param to The recipient address
     * @param amount The amount of ETH to send
     */
    function send(address payable to, uint256 amount) external {
        require(msg.sender == owner(), "Not token owner");
        require(address(this).balance >= amount, "Insufficient funds");
        
        // Increment nonce for each successful execution
        _nonce++;
        
        to.transfer(amount);
    }

    /**
     * @dev ERC721 receiver implementation
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev ERC1155 receiver implementation
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    /**
     * @dev ERC1155 batch receiver implementation
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    /**
     * @dev Transfer ERC20 tokens from this account to a specified address
     * @param _token The ERC20 token contract address
     * @param _to The recipient address
     * @param _amount The amount of tokens to send
     */
    function transferERC20(
        address _token,
        address _to,
        uint256 _amount
    ) external {
        require(msg.sender == owner(), "Not token owner");
        
        _nonce++;
        
        IERC20(_token).transfer(_to, _amount);
    }

    /**
     * @dev Transfer ERC721 token from this account to a specified address
     * @param _token The ERC721 token contract address
     * @param _to The recipient address
     * @param _tokenId The token ID to transfer
     */
    function transferERC721(
        address _token,
        address _to,
        uint256 _tokenId
    ) external {
        require(msg.sender == owner(), "Not token owner");
        
        _nonce++;
        
        IERC721(_token).safeTransferFrom(address(this), _to, _tokenId);
    }

    /**
     * @dev Transfer ERC1155 tokens from this account to a specified address
     * @param _token The ERC1155 token contract address
     * @param _to The recipient address
     * @param _id The token ID to transfer
     * @param _amount The amount of tokens to transfer
     * @param _data Additional data with no specified format
     */
    function transferERC1155(
        address _token,
        address _to,
        uint256 _id,
        uint256 _amount,
        bytes calldata _data
    ) external {
        require(msg.sender == owner(), "Not token owner");
        
        _nonce++;
        
        IERC1155(_token).safeTransferFrom(address(this), _to, _id, _amount, _data);
    }

    /**
     * @dev Batch transfer ERC1155 tokens from this account to a specified address
     * @param _token The ERC1155 token contract address
     * @param _to The recipient address
     * @param _ids An array of token IDs to transfer
     * @param _amounts An array of amounts of tokens to transfer
     * @param _data Additional data with no specified format
     */
    function batchTransferERC1155(
        address _token,
        address _to,
        uint256[] calldata _ids,
        uint256[] calldata _amounts,
        bytes calldata _data
    ) external {
        require(msg.sender == owner(), "Not token owner");
        
        _nonce++;
        
        IERC1155(_token).safeBatchTransferFrom(address(this), _to, _ids, _amounts, _data);
    }
}
