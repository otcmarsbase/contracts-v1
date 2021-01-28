// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract testToken is ERC20
{
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        uint8 decimals
    )
        ERC20(name, symbol)
    {
        _setupDecimals(decimals);
        _mint(msg.sender, totalSupply);
    }
}