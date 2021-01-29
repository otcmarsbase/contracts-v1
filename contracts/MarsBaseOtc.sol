// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./IMarsBaseOtc.sol";
import "./Vault.sol";

contract MarsBaseOtc is Ownable, IMarsBaseOtc, ReentrancyGuard {
    using SafeMath for uint256;

    Vault public vault;
    //     id          owner
    mapping(bytes32 => address) public owners;
    //     id          baseAddr
    mapping(bytes32 => address) public baseAddresses;
    //     id          quoteAddr
    mapping(bytes32 => address) public quoteAddresses;
    //     id          swapped?
    mapping(bytes32 => bool) public isSwapped;
    //     id          cancelled?
    mapping(bytes32 => bool) public isCancelled;
    //      id                base/quote  limit
    mapping(bytes32 => mapping(address => uint256)) public limits;
    //      id                base/quote  raised
    mapping(bytes32 => mapping(address => uint256)) public raised;
    //      id                base/quote  investors
    mapping(bytes32 => mapping(address => address)) public investors;
    //      id                base/quote         investor    amount
    mapping(bytes32 => mapping(address => mapping(address => uint256)))
        public investments;

    modifier onlyInvestor(bytes32 _id, address _token) {
        require(
            _isInvestor(_id, _token, msg.sender),
            "MarsBaseOtc: Allowed only for investors"
        );
        _;
    }

    modifier onlyWhenVaultDefined() {
        require(address(vault) != address(0), "MarsBaseOtc: Vault is not defined");
        _;
    }

    modifier onlyOrderOwner(bytes32 _id) {
        require(msg.sender == owners[_id], "MarsBaseOtc: Allowed only for owner");
        _;
    }

    modifier onlyWhenOrderExists(bytes32 _id) {
        require(owners[_id] != address(0), "MarsBaseOtc: Order doesn't exist");
        _;
    }

    event OrderCreated(
        bytes32 id,
        address owner,
        address baseAddress,
        address quoteAddress,
        uint256 baseLimit,
        uint256 quoteLimit
    );

    event OrderCancelled(bytes32 id);

    event Deposit(
        bytes32 id,
        address token,
        address user,
        uint256 amount,
        uint256 balance
    );

    event Refund(bytes32 id, address token, address user, uint256 amount);

    event OrderSwapped(bytes32 id, address byUser);

    event SwapSend(bytes32 id, address token, address user, uint256 amount);

    constructor() {}

    function tokenFallback(
        address,
        uint256,
        bytes calldata
    ) external {}

    function createOrder(
        bytes32 _id,
        address _baseAddress,
        address _quoteAddress,
        uint256 _baseLimit,
        uint256 _quoteLimit
    ) external override nonReentrant onlyWhenVaultDefined {
        require(owners[_id] == address(0), "MarsBaseOtc: Order already exists");
        require(
            _baseAddress != _quoteAddress,
            "MarsBaseOtc: Exchanged tokens must be different"
        );
        require(_baseLimit > 0, "MarsBaseOtc: Base limit must be positive");
        require(_quoteLimit > 0, "MarsBaseOtc: Quote limit must be positive");

        owners[_id] = msg.sender;
        baseAddresses[_id] = _baseAddress;
        quoteAddresses[_id] = _quoteAddress;
        limits[_id][_baseAddress] = _baseLimit;
        limits[_id][_quoteAddress] = _quoteLimit;

        emit OrderCreated(
            _id,
            msg.sender,
            _baseAddress,
            _quoteAddress,
            _baseLimit,
            _quoteLimit
        );
    }

    function deposit(
        bytes32 _id,
        address _token,
        uint256 _amount
    )
        external
        override
        payable
        nonReentrant
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        if (_token == address(0)) {
            require(
                msg.value == _amount,
                "MarsBaseOtc: Payable value should be equals value"
            );
            address(vault).transfer(msg.value);
        } else {
            require(msg.value == 0, "MarsBaseOtc: Payable not allowed here");
            uint256 allowance =
                IERC20(_token).allowance(msg.sender, address(this));
            require(
                _amount <= allowance,
                "MarsBaseOtc: Allowance should be not less than amount"
            );
            IERC20(_token).transferFrom(msg.sender, address(vault), _amount);
        }
        _deposit(_id, _token, msg.sender, _amount);
    }

    function cancel(bytes32 _id)
        external
        override
        nonReentrant
        onlyOrderOwner(_id)
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        require(!isCancelled[_id], "MarsBaseOtc: Already cancelled");
        require(!isSwapped[_id], "MarsBaseOtc: Already swapped");

        address[2] memory tokens = [baseAddresses[_id], quoteAddresses[_id]];
        for (uint256 t = 0; t < tokens.length; t++) {
            address token = tokens[t];
            address user = investors[_id][token];
            uint256 userInvestment = investments[_id][token][user];
            vault.withdraw(token, user, userInvestment);
        }

        isCancelled[_id] = true;
        emit OrderCancelled(_id);
    }

    function setVault(Vault _vault) external onlyOwner {
        vault = _vault;
    }

    function createKey(address _owner) public view returns (bytes32 result) {
        uint256 creationTime = block.timestamp;
        result = 0x0000000000000000000000000000000000000000000000000000000000000000;
        assembly {
            result := or(result, mul(_owner, 0x1000000000000000000000000))
            result := or(result, and(creationTime, 0xffffffffffffffffffffffff))
        }
    }

    function baseLimit(bytes32 _id) public view returns (uint256) {
        return limits[_id][baseAddresses[_id]];
    }

    function quoteLimit(bytes32 _id) public view returns (uint256) {
        return limits[_id][quoteAddresses[_id]];
    }

    function baseRaised(bytes32 _id) public view returns (uint256) {
        return raised[_id][baseAddresses[_id]];
    }

    function quoteRaised(bytes32 _id) public view returns (uint256) {
        return raised[_id][quoteAddresses[_id]];
    }

    function isBaseFilled(bytes32 _id) public view returns (bool) {
        return
            raised[_id][baseAddresses[_id]] == limits[_id][baseAddresses[_id]];
    }

    function isQuoteFilled(bytes32 _id) public view returns (bool) {
        return
            raised[_id][quoteAddresses[_id]] ==
            limits[_id][quoteAddresses[_id]];
    }

    function baseInvestor(bytes32 _id) public view returns (address) {
        return investors[_id][baseAddresses[_id]];
    }

    function quoteInvestor(bytes32 _id)
        public
        view
        returns (address)
    {
        return investors[_id][quoteAddresses[_id]];
    }

    function baseUserInvestment(bytes32 _id, address _user)
        public
        view
        returns (uint256)
    {
        return investments[_id][baseAddresses[_id]][_user];
    }

    function quoteUserInvestment(bytes32 _id, address _user)
        public
        view
        returns (uint256)
    {
        return investments[_id][quoteAddresses[_id]][_user];
    }

    function _swap(bytes32 _id) internal {
        require(!isSwapped[_id], "MarsBaseOtc: Already swapped");
        require(!isCancelled[_id], "MarsBaseOtc: Already cancelled");
        require(isBaseFilled(_id), "MarsBaseOtc: Base tokens not filled");
        require(isQuoteFilled(_id), "MarsBaseOtc: Quote tokens not filled");

        _distribute(_id, baseAddresses[_id], quoteAddresses[_id]);
        _distribute(_id, quoteAddresses[_id], baseAddresses[_id]);

        isSwapped[_id] = true;
        emit OrderSwapped(_id, msg.sender);
    }

    function _distribute(
        bytes32 _id,
        address _aSide,
        address _bSide
    ) internal {
        uint256 toPayInvestor = raised[_id][_bSide];
        address user = investors[_id][_aSide];
        vault.withdraw(_bSide, user, toPayInvestor);

        emit SwapSend(_id, _bSide, user, toPayInvestor);
    }

    function _deposit(
        bytes32 _id,
        address _token,
        address _from,
        uint256 _amount
    ) internal {
        uint256 amount = _amount;
        require(
            baseAddresses[_id] == _token || quoteAddresses[_id] == _token,
            "MarsBaseOtc: You can deposit only base or quote currency"
        );
        require(
            raised[_id][_token] < limits[_id][_token],
            "MarsBaseOtc: Limit already reached"
        );

        if (!_isInvestor(_id, _token, _from)) {
            require(
                investors[_id][_token] == address(0),
                "MarsBaseOtc: There is already investor in this order"
            );
            investors[_id][_token] = _from;
        }

        uint256 raisedWithOverflow = raised[_id][_token].add(amount);
        if (raisedWithOverflow > limits[_id][_token]) {
            uint256 overflow = raisedWithOverflow.sub(limits[_id][_token]);
            vault.withdraw(_token, _from, overflow);
            amount = amount.sub(overflow);
        }

        investments[_id][_token][_from] = investments[_id][_token][_from].add(
            amount
        );

        raised[_id][_token] = raised[_id][_token].add(amount);
        emit Deposit(
            _id,
            _token,
            _from,
            amount,
            investments[_id][_token][_from]
        );

        if (isBaseFilled(_id) && isQuoteFilled(_id)) {
            _swap(_id);
        }
    }

    function _isInvestor(
        bytes32 _id,
        address _token,
        address _who
    ) internal view returns (bool) {
        return investments[_id][_token][_who] > 0;
    }
}
