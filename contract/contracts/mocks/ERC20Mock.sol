// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ERC20Mock
 * @dev Mock ERC20 token for testing purposes
 */
contract ERC20Mock is ERC20, Ownable {
    uint8 private _decimals;

    /**
     * @dev Constructor that gives the sender all initial tokens
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals_ Token decimals
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimals_;
    }

    /**
     * @dev Returns the number of decimals used for token
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint tokens to the specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
} 