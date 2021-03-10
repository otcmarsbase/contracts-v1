// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "./IMarsBaseOtc.sol";
import "./Vault.sol";

contract MarsBaseOtc is Ownable, IMarsBaseOtc, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeMath for uint16;
    using SafeMath for uint8;

    uint256 public constant BROKERS_DENOMINATOR = 10000;

    Vault public vault;

    // public mappings
    // White list of liquidity tokens
    mapping(address => bool) public isAddressInWhiteList;
    // Info about bids
    mapping(bytes32 => OrderInfo) public orders;
    mapping(bytes32 => BrokerInfo) public ownerBroker;
    mapping(bytes32 => BrokerInfo) public usersBroker;
    mapping(bytes32 => OrdersBidInfo[]) public ordersBid;
    mapping(bytes32 => OrdersBidInfo[]) public ordersOwnerBid;

    // modifiers
    modifier onlyWhenVaultDefined() {
        require(
            address(vault) != address(0),
            "MarsBaseOtc: Vault is not defined"
        );
        _;
    }
    modifier onlyWhenOrderExists(bytes32 _id) {
        require(
            orders[_id].owner != address(0),
            "MarsBaseOtc: Order doesn't exist"
        );
        _;
    }
    modifier onlyOrderOwner(bytes32 _id) {
        require(
            orders[_id].owner == _msgSender(),
            "MarsBaseOtc: Caller is not order owner"
        );
        _;
    }

    event OrderCreated(
        bytes32 id,
        address owner,
        address token,
        uint256 amountOfToken,
        uint256 expiratinDate,
        uint16 discount,
        OrderTypeInfo typeOrder,
        bool isManual
    );

    event BuyOrderDeposit(
        bytes32 _id,
        address _token,
        address _from,
        uint256 _amount
    );

    event SellOrderDeposit(
        bytes32 _id,
        address _token,
        address _from,
        uint256 _amount
    );

    event OrderSwapped(bytes32 id);

    event OrderCancelled(bytes32 id);

    constructor() {}

    function tokenFallback(
        address,
        uint256,
        bytes calldata
    ) external {}

    function createOrder(
        bytes32 _id,
        address _token,
        uint256 _amountOfToken,
        uint256 _expirationDate,
        address _ownerBroker,
        uint256 _ownerBrokerPerc,
        address _usersBroker,
        uint256 _usersBrokerPerc,
        uint16 _discount,
        OrderTypeInfo typeOrder,
        bool _isManual
    ) external override nonReentrant onlyWhenVaultDefined {
        require(
            orders[_id].owner == address(0),
            "MarsBaseOtc: Order already exists"
        );
        require(_amountOfToken > 0, "MarsBaseOtc: Wrong amount");
        require(_discount < 1000, "MarsBaseOtc: Wrong discount");
        require(
            typeOrder != OrderTypeInfo.error,
            "MarsBaseOtc: Wrong type order"
        );
        require(
            _expirationDate > block.timestamp,
            "MarsBaseOtc: Wrong expiration date"
        );

        orders[_id].owner = msg.sender;
        orders[_id].token = _token;
        orders[_id].amountOfToken = _amountOfToken;
        orders[_id].expirationDate = _expirationDate;
        orders[_id].discount = _discount;
        orders[_id].orderType = typeOrder;
        orders[_id].isManual = _isManual;

        if (_ownerBroker != address(0)) {
            require(
                _ownerBrokerPerc > 0 && _ownerBrokerPerc < BROKERS_DENOMINATOR,
                "MarsBaseOtc: Wrong ownerBrokerPerc"
            );
            ownerBroker[_id].broker = _ownerBroker;
            ownerBroker[_id].percents = _ownerBrokerPerc;
        }

        if (_usersBroker != address(0)) {
            require(
                _usersBrokerPerc > 0 && _usersBrokerPerc < BROKERS_DENOMINATOR,
                "MarsBaseOtc: Wrong usersBrokerPerc"
            );
            usersBroker[_id].broker = _usersBroker;
            usersBroker[_id].percents = _usersBrokerPerc;
        }

        emit OrderCreated(
            _id,
            msg.sender,
            _token,
            _amountOfToken,
            _expirationDate,
            _discount,
            typeOrder,
            _isManual
        );
    }

    function orderDeposit(
        bytes32 _id,
        address _token,
        uint256 _amount
    )
        external
        payable
        override
        nonReentrant
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        require(
            block.timestamp <= orders[_id].expirationDate,
            "MarsBaseOtc: Order expired"
        );
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
            require(
                IERC20(_token).transferFrom(
                    msg.sender,
                    address(vault),
                    _amount
                ),
                "MarsBaseOtc: Transfer to contract failed"
            );
        }
        if (orders[_id].orderType == OrderTypeInfo.buyType)
            _buyOrderDeposit(_id, _token, msg.sender, _amount);
        else if (orders[_id].orderType == OrderTypeInfo.sellType)
            _sellOrderDeposit(_id, _token, msg.sender, _amount);
    }

    function cancel(bytes32 _id)
        external
        override
        nonReentrant
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        require(
            orders[_id].isCancelled == false,
            "MarsBaseOtc: Order is already cancelled"
        );
        require(
            orders[_id].isSwapped == false,
            "MarsBaseOtc: Order is already swapped"
        );

        address caller = _msgSender();
        require(
            caller == orders[_id].owner || caller == owner(),
            "MarsBaseOtc: Caller is not admin or owner of order"
        );

        _cancel(_id);

        emit OrderCancelled(_id);
    }

    function makeSwap(bytes32 _id, OrdersBidInfo[] memory distribution)
        external
        override
        nonReentrant
        onlyOwner
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        OrderInfo memory order = orders[_id];
        orders[_id].isSwapped = true;
        require(
            order.isCancelled == false,
            "MarsBaseOtc: Order is already cancelled"
        );
        require(
            order.isSwapped == false,
            "MarsBaseOtc: Order is already swapped"
        );
        require(order.isManual == false, "MarsBaseOtc: Order is not automatic");
        require(
            block.timestamp <= order.expirationDate,
            "MarsBaseOtc: Order expired"
        );
        require(distribution.length > 0, "MarsBaseOtc: Wrong inputs");

        address[] memory ownerTokensInvested;
        uint256[] memory ownerAmountsInvested;
        (ownerTokensInvested, ownerAmountsInvested) = getOrderOwnerInvestments(
            _id
        );

        address[] memory usersTokensInvested;
        uint256[] memory usersAmountsInvested;
        (usersTokensInvested, usersAmountsInvested) = getOrderUserInvestments(
            _id,
            address(0)
        );
        require(
            usersTokensInvested.length > 0,
            "MarsBaseOtc: This order has no user bids"
        );
        require(
            ownerTokensInvested.length > 0,
            "MarsBaseOtc: This order has no owner bids"
        );

        address[] memory orderInvestors = getInvestors(_id);

        uint256 i;
        uint256 ind;
        BrokerInfo memory brInfo;
        uint256 toBroker;
        uint256 toUser;
        for (i = 0; i < distribution.length; i = i.add(1)) {
            if (distribution[i].amountInvested == 0) continue;
            if (distribution[i].investor != order.owner) {
                ind = _findAddress(
                    orderInvestors,
                    distribution[i].investor,
                    orderInvestors.length
                );
                require(
                    ind < orderInvestors.length,
                    "MarsBaseOtc: Wrong user in distribution"
                );
                brInfo = usersBroker[_id];
            } else {
                brInfo = ownerBroker[_id];
            }
            ind = _findAddress(
                ownerTokensInvested,
                distribution[i].investedToken,
                ownerTokensInvested.length
            );
            if (ind >= ownerTokensInvested.length) {
                ind = _findAddress(
                    usersTokensInvested,
                    distribution[i].investedToken,
                    usersTokensInvested.length
                );
                require(
                    ind < usersTokensInvested.length,
                    "MarsBaseOtc: Wrong token address in distribution"
                );
                require(
                    usersAmountsInvested[ind] >= distribution[i].amountInvested,
                    "MarsBaseOtc: Amount of tokens in distribution exceeded the order limits"
                );
                usersAmountsInvested[ind] = usersAmountsInvested[ind].sub(
                    distribution[i].amountInvested
                );
            } else {
                require(
                    ownerAmountsInvested[ind] >= distribution[i].amountInvested,
                    "MarsBaseOtc: Amount of tokens in distribution exceeded the order limits"
                );
                ownerAmountsInvested[ind] = ownerAmountsInvested[ind].sub(
                    distribution[i].amountInvested
                );
            }
            (toBroker, toUser) = _calculateToBrokerToUser(
                distribution[i].amountInvested,
                brInfo.percents
            );
            vault.withdrawForTwo(
                distribution[i].investedToken,
                distribution[i].investor,
                toUser,
                brInfo.broker,
                toBroker
            );
        }

        brInfo = ownerBroker[_id];
        for (i = 0; i < usersTokensInvested.length; i = i.add(1)) {
            if (usersAmountsInvested[i] == 0) continue;
            (toBroker, toUser) = _calculateToBrokerToUser(
                usersAmountsInvested[i],
                brInfo.percents
            );
            vault.withdrawForTwo(
                usersTokensInvested[i],
                brInfo.broker,
                toBroker,
                order.owner,
                toUser
            );
            usersAmountsInvested[i] = 0;
        }

        for (i = 0; i < ownerTokensInvested.length; i = i.add(1)) {
            require(
                ownerAmountsInvested[i] == 0,
                "MarsBaseOtc: Wrong distribution. Not all owner tokens distributed"
            );
        }
        for (i = 0; i < usersTokensInvested.length; i = i.add(1)) {
            require(
                usersAmountsInvested[i] == 0,
                "MarsBaseOtc: Wrong distribution. Not all users tokens distributed"
            );
        }

        emit OrderSwapped(_id);
    }

    function makeSwapOrderOwner(bytes32 _id, uint256 orderIndex)
        external
        override
        nonReentrant
        onlyOrderOwner(_id)
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        require(
            orders[_id].isCancelled == false,
            "MarsBaseOtc: Order is already cancelled"
        );
        require(
            orders[_id].isSwapped == false,
            "MarsBaseOtc: Order is already swapped"
        );
        require(
            orders[_id].isManual == true,
            "MarsBaseOtc: Order is not manual"
        );
        require(
            block.timestamp <= orders[_id].expirationDate,
            "MarsBaseOtc: Order expired"
        );
        uint256 len = ordersBid[_id].length;
        require(len > 0, "MarsBaseOtc: This order has no user bids");
        require(orderIndex < len, "MarsBaseOtc: Wrong orderIndex");

        uint256 toBroker;
        uint256 toUser;
        (toBroker, toUser) = _calculateToBrokerToUser(
            ordersBid[_id][orderIndex].amountInvested,
            ownerBroker[_id].percents
        );
        vault.withdrawForTwo(
            ordersBid[_id][orderIndex].investedToken,
            orders[_id].owner,
            toUser,
            ownerBroker[_id].broker,
            toBroker
        );

        uint256 i;
        for (i = 0; i < len; i = i.add(1)) {
            if (i == orderIndex) continue;
            vault.withdraw(
                ordersBid[_id][i].investedToken,
                ordersBid[_id][i].investor,
                ordersBid[_id][i].amountInvested
            );
        }

        len = ordersOwnerBid[_id].length;
        for (i = 0; i < len; i = i.add(1)) {
            (toBroker, toUser) = _calculateToBrokerToUser(
                ordersOwnerBid[_id][i].amountInvested,
                usersBroker[_id].percents
            );
            vault.withdrawForTwo(
                ordersOwnerBid[_id][i].investedToken,
                ordersBid[_id][orderIndex].investor,
                toUser,
                usersBroker[_id].broker,
                toBroker
            );
        }

        orders[_id].isSwapped = true;

        emit OrderSwapped(_id);
    }

    function cancelBid(bytes32 _id, uint256 bidIndex)
        external
        override
        nonReentrant
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        uint256 len;
        OrdersBidInfo memory bidRead;
        OrdersBidInfo[] storage bidArrWrite;
        address sender = _msgSender();

        if (orders[_id].owner == sender) {
            bidArrWrite = ordersOwnerBid[_id];
        } else {
            bidArrWrite = ordersBid[_id];
        }
        bidRead = bidArrWrite[bidIndex];
        len = bidArrWrite.length;

        require(bidIndex < len, "MarsBaseOtc: Wrong bidIndex");
        require(
            bidRead.investor == sender,
            "MarsBaseOtc: Sender is not investor of this bid"
        );
        vault.withdraw(
            bidRead.investedToken,
            bidRead.investor,
            bidRead.amountInvested
        );

        if (bidIndex < len - 1) bidArrWrite[bidIndex] = bidArrWrite[len - 1];

        bidArrWrite.pop();
    }

    function changeBid(
        bytes32 _id,
        uint256 bidIndex,
        uint256 newValue
    ) external nonReentrant onlyWhenVaultDefined onlyWhenOrderExists(_id) {
        require(newValue > 0, "MarsBaseOtc: Wrong new value");

        uint256 len;
        OrdersBidInfo memory bidRead;
        OrdersBidInfo[] storage bidArrWrite;
        address sender = _msgSender();

        if (orders[_id].owner == sender) {
            bidArrWrite = ordersOwnerBid[_id];
        } else {
            bidArrWrite = ordersBid[_id];
        }
        bidRead = bidArrWrite[bidIndex];
        len = bidArrWrite.length;

        require(bidIndex < len, "MarsBaseOtc: Wrong bidIndex");
        require(
            bidRead.investor == sender,
            "MarsBaseOtc: Sender is not investor of this bid"
        );

        if (bidRead.amountInvested < newValue) {
            require(
                IERC20(bidRead.investedToken).transferFrom(
                    sender,
                    address(vault),
                    newValue.sub(bidRead.amountInvested)
                ),
                "MarsBaseOtc: Transfer failed"
            );
            bidArrWrite[bidIndex].amountInvested = newValue;
        } else if (bidRead.amountInvested > newValue) {
            vault.withdraw(
                bidRead.investedToken,
                bidRead.investor,
                bidRead.amountInvested.sub(newValue)
            );
            bidArrWrite[bidIndex].amountInvested = newValue;
        } else revert("MarsBaseOtc: Wrong new value");
    }

    function contractTimestamp() external view returns (uint256) {
        return block.timestamp;
    }

    function setVault(Vault _vault) external onlyOwner {
        vault = _vault;
    }

    function setDiscount(bytes32 _id, uint16 newDiscount)
        external
        onlyOrderOwner(_id)
        onlyWhenOrderExists(_id)
    {
        orders[_id].discount = newDiscount;
    }

    function setAmountOfToken(bytes32 _id, uint256 newAmountOfToken)
        external
        onlyOrderOwner(_id)
        onlyWhenOrderExists(_id)
    {
        orders[_id].amountOfToken = newAmountOfToken;
    }

    function addWhiteList(address newToken) external {
        isAddressInWhiteList[newToken] = true;
    }

    function deleteFromWhiteList(address tokenToDelete) external {
        isAddressInWhiteList[tokenToDelete] = false;
    }

    // view functions
    function createKey(address _owner) public view returns (bytes32 result) {
        uint256 creationTime = block.timestamp;
        result = 0x0000000000000000000000000000000000000000000000000000000000000000;
        assembly {
            result := or(result, mul(_owner, 0x1000000000000000000000000))
            result := or(result, and(creationTime, 0xffffffffffffffffffffffff))
        }
    }

    function ordersBidLen(bytes32 id) external view returns (uint256) {
        return ordersBid[id].length;
    }

    function ordersOwnerBidLen(bytes32 id) external view returns (uint256) {
        return ordersOwnerBid[id].length;
    }

    function getOrderOwnerInvestments(bytes32 id)
        public
        view
        returns (address[] memory tokens, uint256[] memory amount)
    {
        return _getUserInvestments(ordersOwnerBid[id], orders[id].owner);
    }

    function getOrderUserInvestments(bytes32 id, address user)
        public
        view
        returns (address[] memory tokens, uint256[] memory amount)
    {
        return _getUserInvestments(ordersBid[id], user);
    }

    function getInvestors(bytes32 id)
        public
        view
        returns (address[] memory investors)
    {
        OrdersBidInfo[] storage bids = ordersBid[id];
        uint256 len = bids.length;
        investors = new address[](len);
        uint256 count = 0;
        for (uint256 i = 0; i < len; i = i.add(1)) {
            uint256 ind = _findAddress(investors, bids[i].investor, count);
            if (ind == count) {
                investors[count] = bids[i].investor;
                count = count.add(1);
            } else if (ind > count)
                revert("MarsBaseOtc: Internal error getInvestors");
        }
        uint256 delta = len.sub(count);
        if (delta > 0) {
            // decrease len of arrays tokens and amount
            // https://ethereum.stackexchange.com/questions/51891/how-to-pop-from-decrease-the-length-of-a-memory-array-in-solidity
            assembly {
                mstore(investors, sub(mload(investors), delta))
            }
        }
    }

    // private functions
    function _buyOrderDeposit(
        bytes32 _id,
        address _token,
        address _from,
        uint256 _amount
    ) private {
        OrdersBidInfo memory ownersBid =
            OrdersBidInfo({
                investor: _from,
                investedToken: _token,
                amountInvested: _amount
            });

        if (_from == orders[_id].owner) {
            require(
                isAddressInWhiteList[_token] == true,
                "MarsBaseOtc: Token is not in the white list"
            );
            ordersOwnerBid[_id].push(ownersBid);
        } else {
            require(_token == orders[_id].token, "MarsBaseOtc: Wrong token");
            ordersBid[_id].push(ownersBid);
        }

        emit BuyOrderDeposit(_id, _token, _from, _amount);
    }

    function _sellOrderDeposit(
        bytes32 _id,
        address _token,
        address _from,
        uint256 _amount
    ) private {
        OrdersBidInfo memory ownersBid =
            OrdersBidInfo({
                investor: _from,
                investedToken: _token,
                amountInvested: _amount
            });

        if (_from == orders[_id].owner) {
            require(_token == orders[_id].token, "MarsBaseOtc: Wrong token");
            ordersOwnerBid[_id].push(ownersBid);
        } else {
            require(
                isAddressInWhiteList[_token] == true,
                "MarsBaseOtc: Token is not in the white list"
            );
            ordersBid[_id].push(ownersBid);
        }

        emit SellOrderDeposit(_id, _token, _from, _amount);
    }

    function _cancel(bytes32 _id)
        private
        onlyWhenVaultDefined
        onlyWhenOrderExists(_id)
    {
        require(
            orders[_id].isCancelled == false,
            "MarsBaseOtc: Order is already cancelled"
        );
        require(
            orders[_id].isSwapped == false,
            "MarsBaseOtc: Order is already swapped"
        );

        address[] memory tokens;
        uint256[] memory investments;
        (tokens, investments) = getOrderOwnerInvestments(_id);
        uint256 len = tokens.length;
        uint256 i;
        for (i = 0; i < len; i = i.add(1)) {
            vault.withdraw(tokens[i], orders[_id].owner, investments[i]);
        }

        address[] memory investors = getInvestors(_id);
        len = investors.length;
        uint256 len2;
        uint256 j;
        for (i = 0; i < len; i = i.add(1)) {
            (tokens, investments) = getOrderUserInvestments(_id, investors[i]);
            len2 = tokens.length;
            for (j = 0; j < len2; j = j.add(1)) {
                vault.withdraw(tokens[j], investors[i], investments[j]);
            }
        }

        orders[_id].isCancelled = true;
    }

    function _getUserInvestments(OrdersBidInfo[] storage bids, address user)
        private
        view
        returns (address[] memory tokens, uint256[] memory amount)
    {
        uint256 len = bids.length;
        tokens = new address[](len);
        amount = new uint256[](len);
        uint256 count = 0;
        for (uint256 i = 0; i < len; i = i.add(1)) {
            if (user == address(0) || bids[i].investor == user) {
                uint256 ind =
                    _findAddress(tokens, bids[i].investedToken, count);
                if (ind < count) {
                    amount[ind] = amount[ind].add(bids[i].amountInvested);
                } else {
                    tokens[count] = bids[i].investedToken;
                    amount[count] = bids[i].amountInvested;
                    count = count.add(1);
                }
            }
        }
        uint256 delta = len.sub(count);
        if (delta > 0) {
            // decrease len of arrays tokens and amount
            // https://ethereum.stackexchange.com/questions/51891/how-to-pop-from-decrease-the-length-of-a-memory-array-in-solidity
            assembly {
                mstore(tokens, sub(mload(tokens), delta))
            }
            assembly {
                mstore(amount, sub(mload(amount), delta))
            }
        }
    }

    function _findAddress(
        address[] memory array,
        address toFind,
        uint256 len
    ) private pure returns (uint256 i) {
        require(array.length >= len, "MarsBaseOtc: Wrong len argument");
        for (i = 0; i < len; i = i.add(1)) {
            if (array[i] == toFind) return i;
        }
    }

    function _calculateToBrokerToUser(uint256 amount, uint256 brokerPerc)
        private
        pure
        returns (uint256 toBroker, uint256 toUser)
    {
        toBroker = amount.mul(brokerPerc).div(BROKERS_DENOMINATOR);
        toUser = amount.sub(toBroker);
    }
}
