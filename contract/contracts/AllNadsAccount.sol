// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title IERC6551Account
 * @notice Interface for ERC6551 token bound accounts
 */
interface IERC6551Account {
    /**
     * @notice Returns identifier of the ERC-721 token which owns the account
     * @return chainId The chain id
     * @return tokenContract The address of the token contract
     * @return tokenId The id of the token
     */
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);

    /**
     * @notice Executes a transaction from the account
     * @param to The target address of the transaction
     * @param value The native token value of the transaction
     * @param data The data of the transaction
     * @param operation The operation to execute
     * @return The result of the transaction
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable returns (bytes memory);
}

/**
 * @title IERC6551Executable
 * @notice Interface for ERC6551 execution
 */
interface IERC6551Executable {
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable returns (bytes memory);
}

/**
 * @title AllNadsAccount
 * @notice Implementation of ERC6551 token bound accounts for AllNads
 * @dev This contract is used to create accounts for each AllNads NFT
 */
contract AllNadsAccount is IERC165, IERC1271, IERC6551Account, IERC6551Executable, IERC1155Receiver, IERC721Receiver {
    // Operation types
    uint8 public constant OPERATION_CALL = 0;
    uint8 public constant OPERATION_DELEGATECALL = 1;
    uint8 public constant OPERATION_CREATE = 2;
    uint8 public constant OPERATION_CREATE2 = 3;

    // Track state changes
    uint256 public state;

    // Validation errors
    error NotAuthorized();
    error OperationNotSupported();
    error InvalidNonce();
    error InvalidSignature();
    error EtherTransferFailed();

    /**
     * @notice Ensures the caller is authorized to execute on this account
     */
    modifier onlyAuthorized() {
        if (!isAuthorized(msg.sender)) {
            revert NotAuthorized();
        }
        _;
    }

    event DebugToken(uint256 chainId, address tokenContract, uint256 tokenId);

function debugToken() external {
    (uint256 chainId, address tokenContract, uint256 tokenId) = token();
    emit DebugToken(chainId, tokenContract, tokenId);
}

    /**
     * @notice Receives ERC-1155 tokens
     * @dev Required to implement IERC1155Receiver
     */
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    /**
     * @notice Receives ERC-1155 batch transfers
     * @dev Required to implement IERC1155Receiver
     */
    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    /**
     * @notice Receives ERC-721 tokens
     * @dev Required to implement IERC721Receiver
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @notice Returns the token that owns this account
     * @return chainId The chainId of the token
     * @return tokenContract The token contract address
     * @return tokenId The token ID
     */
    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footprint = _getAccountStorage();

        // Extract values from the footprint [chainid (32) + tokenContract (32) + tokenId (32)]
        assembly {
            chainId := mload(add(footprint, 32))
            tokenContract := mload(add(footprint, 64))
            tokenId := mload(add(footprint, 96))
        }
    }

    /**
     * @notice Returns the current account nonce
     * @dev Used for replay protection
     */
    function nonce() public view returns (uint256) {
        return state;
    }

    /**
     * @notice Executes a transaction on behalf of the token bound account
     * @param to The target address of the transaction
     * @param value The native token value of the transaction
     * @param data The data of the transaction
     * @param operation The operation to execute
     * @return result The result of the transaction
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable onlyAuthorized returns (bytes memory result) {
        state++;

        if (operation == OPERATION_CALL) {
            bool success;
            (success, result) = to.call{value: value}(data);
            if (!success) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        } else if (operation == OPERATION_DELEGATECALL) {
            // Delegatecall is not supported for simplicity and security reasons
            revert OperationNotSupported();
        } else {
            revert OperationNotSupported();
        }

        return result;
    }

    /**
     * @notice Executes a transaction from another contract
     * @param to The target address of the transaction
     * @param value The native token value of the transaction
     * @param data The data of the transaction
     * @param operation The operation to execute
     * @return result The result of the transaction
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable virtual returns (bytes memory result) {
        return this.executeCall(to, value, data, operation);
    }

    /**
     * @notice Checks if a given signature is valid for this account
     * @param hash The hash of the data being signed
     * @param signature The signature to validate
     * @return magicValue The ERC1271 magic value if valid
     */
    function isValidSignature(bytes32 hash, bytes memory signature)
        external
        view
        virtual
        returns (bytes4 magicValue)
    {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        
        if (chainId != block.chainid) {
            return "";
        }

        address owner = IERC721(tokenContract).ownerOf(tokenId);
        
        if (_isValidERC1271Signature(owner, hash, signature)) {
            return IERC1271.isValidSignature.selector;
        }
        
        if (_isValidEOASignature(owner, hash, signature)) {
            return IERC1271.isValidSignature.selector;
        }
        
        return "";
    }

    /**
     * @notice Checks if the caller is authorized to execute on this account
     * @param caller The address to check
     * @return isAuth Whether the caller is authorized
     */
    function isAuthorized(address caller) public view returns (bool) {
        // Production code follows
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        
        // If the token is on another chain, no one is authorized
        if (chainId != block.chainid) {
            return false;
        }

        // Get owner of the token
        address owner = IERC721(tokenContract).ownerOf(tokenId);
        
        // Authorize the owner of the token
        if (caller == owner) {
            return true;
        }
        
        // Authorize approved operators
        if (IERC721(tokenContract).isApprovedForAll(owner, caller)) {
            return true;
        }
        
        // Authorize approved address for this specific token
        if (IERC721(tokenContract).getApproved(tokenId) == caller) {
            return true;
        }
        
        return false;
    }

    /**
     * @notice Supports ERC165 interface detection
     * @param interfaceId The interface ID to check
     * @return Whether the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC6551Executable).interfaceId;
    }

    /**
     * @notice Handles receiving native tokens
     */
    receive() external payable {}

    /**
     * @notice Event emitted when an unknown function is called
     * @param sender The sender of the call
     * @param value The ETH value sent with the call
     * @param data The calldata of the call
     */
    event UnknownCallReceived(address indexed sender, uint256 value, bytes data);

    /**
     * @notice Fallback function for handling unknown calls
     * @dev Only authorized users can trigger the fallback function
     */
    fallback() external payable {
        // 确保只有授权用户可以触发fallback
        if (!isAuthorized(msg.sender)) {
            revert NotAuthorized();
        }
        
        // 增加状态变量以防止重放攻击
        state++;
        
        // 记录未知调用的事件，便于链下分析
        emit UnknownCallReceived(msg.sender, msg.value, msg.data);
    }

    /**
     * @notice Gets the account storage from the proxy
     * @return result The account storage
     */
    function _getAccountStorage() internal view returns (bytes memory) {
        uint256 size;
        address self = address(this);
        assembly {
            size := extcodesize(self)
        }
        
        bytes memory code = new bytes(size);
        assembly {
            extcodecopy(self, add(code, 0x20), 0, size)
        }
        
        return code;
    }

    /**
     * @notice Checks if a signature is valid for an ERC1271 contract
     * @param signer The signing address
     * @param hash The hash of the data being signed
     * @param signature The signature to validate
     * @return Whether the signature is valid
     */
    function _isValidERC1271Signature(
        address signer,
        bytes32 hash,
        bytes memory signature
    ) internal view returns (bool) {
        (bool success, bytes memory result) = signer.staticcall(
            abi.encodeWithSelector(IERC1271.isValidSignature.selector, hash, signature)
        );
        
        return (
            success &&
            result.length >= 4 &&
            abi.decode(result, (bytes4)) == IERC1271.isValidSignature.selector
        );
    }

    /**
     * @notice Checks if a signature is valid for an EOA
     * @param signer The signing address
     * @param hash The hash of the data being signed
     * @param signature The signature to validate
     * @return Whether the signature is valid
     */
    function _isValidEOASignature(
        address signer,
        bytes32 hash,
        bytes memory signature
    ) internal view returns (bool) {
        return SignatureChecker.isValidSignatureNow(
            signer, 
            MessageHashUtils.toEthSignedMessageHash(hash), 
            signature
        );
    }
    
    /**
     * @notice Transfer ERC20 tokens from this account
     * @dev Only authorized addresses can call
     * @param tokenContract ERC20 token address
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return success Whether the transfer was successful
     */
    function transferERC20(
        address tokenContract,
        address to,
        uint256 amount
    ) external onlyAuthorized returns (bool) {
        state++;
        (bool success, bytes memory data) = tokenContract.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount) // transfer(address,uint256)
        );
        
        if (!success) {
            assembly {
                revert(add(data, 32), mload(data))
            }
        }
        
        return abi.decode(data, (bool));
    }
    
    /**
     * @notice Helper function to transfer multiple ERC20 tokens
     * @param tokens Array of ERC20 token addresses
     * @param to Recipient address
     * @param amounts Array of amounts to transfer
     */
    function batchTransferERC20(
        address[] calldata tokens,
        address to,
        uint256[] calldata amounts
    ) external onlyAuthorized {
        require(tokens.length == amounts.length, "Array length mismatch");
        
        state++;
        for (uint256 i = 0; i < tokens.length; i++) {
            (bool success, bytes memory data) = tokens[i].call(
                abi.encodeWithSelector(0xa9059cbb, to, amounts[i])
            );
            
            if (!success) {
                assembly {
                    revert(add(data, 32), mload(data))
                }
            }
        }
    }
    
    /**
     * @notice Transfer ERC721 tokens from this account
     * @dev Only authorized addresses can call
     * @param tokenContract NFT contract address
     * @param to Recipient address
     * @param tokenId Token ID to transfer
     */
    function transferERC721(
        address tokenContract,
        address to,
        uint256 tokenId
    ) external onlyAuthorized {
        state++;
        (bool success, bytes memory data) = tokenContract.call(
            abi.encodeWithSelector(0x42842e0e, address(this), to, tokenId) // safeTransferFrom(address,address,uint256)
        );
        
        if (!success) {
            assembly {
                revert(add(data, 32), mload(data))
            }
        }
    }
    
    /**
     * @notice Helper function to transfer multiple ERC721 tokens
     * @param tokens Array of ERC721 token addresses
     * @param to Recipient address
     * @param tokenIds Array of token IDs to transfer
     */
    function batchTransferERC721(
        address[] calldata tokens,
        address to,
        uint256[] calldata tokenIds
    ) external onlyAuthorized {
        require(tokens.length == tokenIds.length, "Array length mismatch");
        
        state++;
        for (uint256 i = 0; i < tokens.length; i++) {
            (bool success, bytes memory data) = tokens[i].call(
                abi.encodeWithSelector(0x42842e0e, address(this), to, tokenIds[i])
            );
            
            if (!success) {
                assembly {
                    revert(add(data, 32), mload(data))
                }
            }
        }
    }
} 