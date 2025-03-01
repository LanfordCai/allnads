// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ERC1155Mock
 * @dev Mock implementation of the ERC1155 token standard for testing
 */
contract ERC1155Mock is ERC1155, Ownable {
    constructor(
        string memory uri_
    ) ERC1155(uri_) Ownable(msg.sender) {}

    /**
     * @dev Mint a token.
     * @param to The address that will receive the minted token
     * @param id The ID of the token to mint
     * @param amount The amount of tokens to mint
     * @param data Additional data to send along with the mint operation
     */
    function mint(address to, uint256 id, uint256 amount, bytes memory data) public {
        _mint(to, id, amount, data);
    }

    /**
     * @dev Mint a batch of tokens.
     * @param to The address that will receive the minted tokens
     * @param ids The IDs of the tokens to mint
     * @param amounts The amounts of tokens to mint
     * @param data Additional data to send along with the mint operation
     */
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) public {
        _mintBatch(to, ids, amounts, data);
    }

    /**
     * @dev Burn a token.
     * @param account The address that owns the token
     * @param id The ID of the token to burn
     * @param amount The amount of tokens to burn
     */
    function burn(address account, uint256 id, uint256 amount) public {
        _burn(account, id, amount);
    }

    /**
     * @dev Burn a batch of tokens.
     * @param account The address that owns the tokens
     * @param ids The IDs of the tokens to burn
     * @param amounts The amounts of tokens to burn
     */
    function burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) public {
        _burnBatch(account, ids, amounts);
    }
} 