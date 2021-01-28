// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

interface IMarsBaseOtc {
    function createOrder(
        bytes32 _id,
        address _baseAddress,
        address _quoteAddress,
        uint256 _baseLimit,
        uint256 _quoteLimit
    ) external;

    function deposit(bytes32 _id, address _token, uint _amount)
        external
        payable;
}