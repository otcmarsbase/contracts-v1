// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

interface IMarsBaseOtc {
    function createBuyOrder(
        bytes32 _id,
        address _tokenToBuy,
        uint256 _amountOfTokensToBuy,
        uint16 _discount
    ) external;

    function buyOrderDeposit(
        bytes32 _id,
        address _token,
        uint256 _amount
    ) external payable;
}