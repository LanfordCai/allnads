// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title AllNadsRegistry
 * @notice Implementation of ERC6551 registry for AllNads
 * @dev This contract is used to create and lookup token bound accounts for AllNads NFTs
 */
contract AllNadsRegistry {
    /**
     * @notice Emitted when a new account is created
     * @param account The address of the created account
     * @param implementation The implementation contract of the created account
     * @param chainId The chainId the contract exists on
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt An arbitrary value to allow creating multiple accounts for the same token
     */
    event AccountCreated(
        address account,
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    );

    /**
     * @notice Creates a token bound account for a non-fungible token
     * @dev The created account is a contract that can be used to manage assets associated with the token
     * @param implementation The implementation contract for the account
     * @param chainId The chainId of the token
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt An arbitrary value to allow creating multiple accounts for the same token
     * @param initData Optional initialization data to configure the account
     * @return account The address of the created account
     */
    function createAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes calldata initData
    ) external returns (address) {
        bytes32 bytecodeHash = _getBytecodeHash(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );

        address account = _getAccountAddress(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt,
            bytecodeHash
        );

        uint256 codeSize;
        assembly {
            codeSize := extcodesize(account)
        }

        if (codeSize == 0) {
            // Account does not exist yet, create it
            bytes memory creationCode = _getCreationCode(
                implementation,
                chainId,
                tokenContract,
                tokenId,
                salt
            );

            assembly {
                account := create(0, add(creationCode, 0x20), mload(creationCode))
            }

            if (account == address(0)) {
                revert("Account creation failed");
            }

            if (initData.length > 0) {
                // Initialize the account
                (bool success, ) = account.call(initData);
                if (!success) {
                    revert("Account initialization failed");
                }
            }
        }

        emit AccountCreated(
            account,
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );

        return account;
    }

    /**
     * @notice Returns the computed account address for a token
     * @param implementation The implementation contract for the account
     * @param chainId The chainId of the token
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt An arbitrary value to allow creating multiple accounts for the same token
     * @return account The computed account address
     */
    function getAccount(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) external view returns (address) {
        bytes32 bytecodeHash = _getBytecodeHash(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );

        return _getAccountAddress(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt,
            bytecodeHash
        );
    }

    /**
     * @notice Returns the bytecode hash for a token bound account
     * @param implementation The implementation contract for the account
     * @param chainId The chainId of the token
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt An arbitrary value to allow creating multiple accounts for the same token
     * @return bytecodeHash The bytecode hash of the account
     */
    function _getBytecodeHash(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) internal pure returns (bytes32) {
        bytes memory creationCode = _getCreationCode(
            implementation,
            chainId,
            tokenContract,
            tokenId,
            salt
        );

        return keccak256(creationCode);
    }

    /**
     * @notice Returns the creation code for a token bound account
     * @param implementation The implementation contract for the account
     * @param chainId The chainId of the token
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt An arbitrary value to allow creating multiple accounts for the same token
     * @return creationCode The creation code of the account
     */
    function _getCreationCode(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            implementation,
            hex"5af43d82803e903d91602b57fd5bf3",
            abi.encode(chainId, tokenContract, tokenId, salt)
        );
    }

    /**
     * @notice Returns the computed account address for a token
     * @param implementation The implementation contract for the account
     * @param chainId The chainId of the token
     * @param tokenContract The address of the token contract
     * @param tokenId The id of the token
     * @param salt An arbitrary value to allow creating multiple accounts for the same token
     * @param bytecodeHash The bytecode hash of the account
     * @return account The computed account address
     */
    function _getAccountAddress(
        address implementation,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId,
        uint256 salt,
        bytes32 bytecodeHash
    ) internal view returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this), // salt is applied by this contract
                            keccak256(abi.encode(implementation, chainId, tokenContract, tokenId, salt)), // unique salt per account
                            bytecodeHash
                        )
                    )
                )
            )
        );
    }
} 