// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Create2.sol";
import "./interfaces/IERC6551Registry.sol";

/**
 * @title AllNadsRegistry
 * @dev Registry for creating token-bound accounts for AllNads NFTs
 */
contract AllNadsRegistry is IERC6551Registry {
    error InitializationFailed();
    
    /**
     * @dev Creates a new token-bound account for a given token
     * @param implementation The implementation contract for the account
     * @param chainId The chainId where the token exists
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt A salt to ensure unique account address generation
     * @param initData Initialization data for the account
     * @return The address of the created account
     */
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address) {
        bytes memory code = _creationCode(implementation, chainId, tokenContract, tokenId, salt);

        address _account = Create2.computeAddress(
            bytes32(salt),
            keccak256(code)
        );

        if (_account.code.length != 0) return _account;

        _account = Create2.deploy(0, bytes32(salt), code);

        if (initData.length != 0) {
            (bool success, ) = _account.call(initData);
            if (!success) revert InitializationFailed();
        }

        emit AccountCreated(
            _account,
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );

        return _account;
    }

    /**
     * @dev Computes the account address for a given token
     * @param implementation The implementation contract for the account
     * @param chainId The chainId where the token exists
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt A salt for unique account address generation
     * @return The computed address of the account
     */
    function account(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        bytes32 bytecodeHash = keccak256(
            _creationCode(implementation, chainId, tokenContract, tokenId, salt)
        );

        return Create2.computeAddress(bytes32(salt), bytecodeHash);
    }

    /**
     * @dev Generates the creation code for a token-bound account
     * @param implementation_ The implementation contract address
     * @param chainId_ The chainId where the token exists
     * @param tokenContract_ The token contract address
     * @param tokenId_ The token id
     * @param salt_ The salt for unique address generation
     * @return The creation code for the account
     */
    function _creationCode(
        address implementation_,
        uint256 chainId_,
        address tokenContract_,
        uint256 tokenId_,
        uint256 salt_
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                hex"3d60ad80600a3d3981f3363d3d373d3d3d363d73",
                implementation_,
                hex"5af43d82803e903d91602b57fd5bf3",
                abi.encode(salt_, chainId_, tokenContract_, tokenId_)
            );
    }
}
