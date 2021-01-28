// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract Vault is Ownable {
    address public marsBaseOtc;

    modifier onlyMarsBaseOtc() {
        require(msg.sender == marsBaseOtc);
        _;
    }

    receive() external payable {}

    function tokenFallback(address, uint, bytes calldata) external {}

    function setMarsBaseOtc(address _marsBaseOtc) public onlyOwner {
        marsBaseOtc = _marsBaseOtc;
    }

    function withdraw(address _token, address _receiver, uint _amount)
        public
        onlyMarsBaseOtc
    {
        if (_token == address(0)) {
            payable(_receiver).transfer(_amount);
        } else {
            IERC20(_token).transfer(_receiver, _amount);
        }
    }
}