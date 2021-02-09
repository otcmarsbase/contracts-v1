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
    using SafeMath for uint16;
    using SafeMath for uint8;

    Vault public vault;

    struct BuyOrderInfo{
        address owner;
        address tokenToBuy;
        uint256 amountOfTokensToBuy;
        uint16 discount; // 10 is 1%, max value 1'000
        bool isCancelled;
        bool isSwapped;
    }
    struct BuyOrdersBidInfo{
        address investor;
        address investedToken;
        uint256 amountInvested;
    }
    enum OrderTypeInfo {error, buyType, sellType}


    // public mappings
    // White list of liquidity tokens
    mapping(address => bool) public isAddressInWhiteList;
    // Info about bids
    mapping(bytes32 => OrderTypeInfo) public orderType;
    mapping(bytes32 => BuyOrderInfo) public buyOrders;
    mapping(bytes32 => BuyOrdersBidInfo[]) public buyOrdersBid;
    mapping(bytes32 => BuyOrdersBidInfo[]) public buyOrdersOwnerBid;

    // modifiers
    modifier onlyWhenVaultDefined() {
        require(
            address(vault) != address(0),
            "MarsBaseOtc: Vault is not defined"
        );
        _;
    }
    modifier onlyOrderOwner(bytes32 _id) {
        require(
            msg.sender == buyOrders[_id].owner,
            "MarsBaseOtc: Allowed only for owner"
        );
        _;
    }
    modifier onlyWhenOrderExists(bytes32 _id) {
        require(
            buyOrders[_id].owner != address(0),
            "MarsBaseOtc: Order doesn't exist"
        );
        _;
    }
    modifier onlyBuyOrder(bytes32 _id) {
        require(
            orderType[_id] == OrderTypeInfo.buyType,
            "MarsBaseOtc: This order is not buy type"
        );
        _;
    }
    modifier onlySellOrder(bytes32 _id) {
        require(
            orderType[_id] == OrderTypeInfo.sellType,
            "MarsBaseOtc: This order is not buy type"
        );
        _;
    }
    modifier onlyWhiteListAddress(address arg){
        require(
            isAddressInWhiteList[arg] == true,
            "MarsBaseOtc: Address is not in whiteList"
        );
        _;
    }

    event BuyOrderCreated(
        bytes32 id,
        address owner,
        address tokenToBuy,
        uint256 amountOfTokensToBuy,
        uint16 discount
    );

    event BuyOrderDeposit(
        bytes32 _id,
        address _token,
        address _from,
        uint256 _amount
    );

    event OrderCancelled(bytes32 id);

    constructor() {}

    function tokenFallback(
        address,
        uint256,
        bytes calldata
    ) external {}

    function createBuyOrder(
        bytes32 _id,
        address _tokenToBuy,
        uint256 _amountOfTokensToBuy,
        uint16 _discount
    )
        external
        override
        nonReentrant
        onlyWhenVaultDefined
    {
        require(
            buyOrders[_id].owner == address(0),
            "MarsBaseOtc: Order already exists"
        );
        require(
            _amountOfTokensToBuy > 0,
            "MarsBaseOtc: Wrong amount to buy"
        );
        require(
            _discount < 1000,
            "MarsBaseOtc: Wrong discount"
        );

        buyOrders[_id].owner = msg.sender;
        buyOrders[_id].tokenToBuy = _tokenToBuy;
        buyOrders[_id].amountOfTokensToBuy = _amountOfTokensToBuy;
        buyOrders[_id].discount = _discount;

        orderType[_id] = OrderTypeInfo.buyType;

        emit BuyOrderCreated(
            _id,
            msg.sender,
            _tokenToBuy,
            _amountOfTokensToBuy,
            _discount
        );
    }

    function buyOrderDeposit(
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
        onlyBuyOrder(_id)
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
        _buyOrderDeposit(_id, _token, msg.sender, _amount);
    }

    /* function cancel(bytes32 _id)
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
    } */

    function setVault(Vault _vault) external onlyOwner {
        vault = _vault;
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

    function buyOrdersBidLen(bytes32 id) external view returns(uint256) {
        return buyOrdersBid[id].length;
    }

    function buyOrdersOwnerBidLen(bytes32 id) external view returns(uint256) {
        return buyOrdersOwnerBid[id].length;
    }

    function getOrderOwnerInvestments(
        bytes32 id
    )
        external
        view
        returns(
            address[] memory tokens,
            uint256[] memory amount
        )
    {
        return _getUserInvestments(buyOrdersOwnerBid[id], buyOrders[id].owner);
    }

    function getOrderUserInvestments(
        bytes32 id,
        address user
    )
        external
        view
        returns(
            address[] memory tokens,
            uint256[] memory amount
        )
    {
        return _getUserInvestments(buyOrdersBid[id], user);
    }

    function getInvestors(
        bytes32 id
    )
        external
        view
        returns(
            address[] memory investors
        )
    {
        BuyOrdersBidInfo[] storage bids = buyOrdersBid[id];
        uint256 len = bids.length;
        investors = new address[](len);
        uint256 count = 0;
        for(uint256 i = 0; i < len; i = i.add(1))
        {
            uint256 ind = _findAddress(investors, bids[i].investor, count);
            if (ind == count)
            {
                investors[count] = bids[i].investor;
                count = count.add(1);
            }
            else if (ind > count)
                revert("MarsBaseOtc: Internal error getInvestors");
        }
        uint256 delta = len.sub(count);
        if (delta > 0)
        {
            // decrease len of arrays tokens and amount
            // https://ethereum.stackexchange.com/questions/51891/how-to-pop-from-decrease-the-length-of-a-memory-array-in-solidity
            assembly { mstore(investors, sub(mload(investors), delta)) }
        }
    }

    // private functions
    function _buyOrderDeposit(
        bytes32 _id,
        address _token,
        address _from,
        uint256 _amount
    )
        private
    {
        BuyOrdersBidInfo memory ownersBid = BuyOrdersBidInfo({
            investor: _from,
            investedToken: _token,
            amountInvested: _amount
        });

        if (_from == buyOrders[_id].owner)
        {
            require(
                isAddressInWhiteList[_token] == true,
                "MarsBaseOtc: Token is not in the white list"
            );
            buyOrdersOwnerBid[_id].push(ownersBid);
        }
        else
        {
            require(
                _token == buyOrders[_id].tokenToBuy,
                "MarsBaseOtc: Wrong token"
            );
            buyOrdersBid[_id].push(ownersBid);
        }

        emit BuyOrderDeposit(
            _id,
            _token,
            _from,
            _amount
        );
    }

    function _getUserInvestments(
        BuyOrdersBidInfo[] storage bids,
        address user
    )
        private
        view
        returns(
            address[] memory tokens,
            uint256[] memory amount
        )
    {
        uint256 len = bids.length;
        tokens = new address[](len);
        amount = new uint256[](len);
        uint256 count = 0;
        for(uint256 i = 0; i < len; i = i.add(1))
        {
            if (bids[i].investor == user)
            {
                uint256 ind = _findAddress(tokens, bids[i].investedToken, count);
                if (ind < count)
                {
                    amount[ind] = amount[ind].add(bids[i].amountInvested);
                }
                else
                {
                    tokens[count] = bids[i].investedToken;
                    amount[count] = bids[i].amountInvested;
                    count = count.add(1);
                }
            }
        }
        uint256 delta = len.sub(count);
        if (delta > 0)
        {
            // decrease len of arrays tokens and amount
            // https://ethereum.stackexchange.com/questions/51891/how-to-pop-from-decrease-the-length-of-a-memory-array-in-solidity
            assembly { mstore(tokens, sub(mload(tokens), delta)) }
            assembly { mstore(amount, sub(mload(amount), delta)) }
        }
    }

    function _findAddress(
        address[] memory array,
        address toFind,
        uint256 len
    )
        private
        pure
        returns (uint256 i)
    {
        require(
            array.length >= len,
            "MarsBaseOtc: Wrong len argument"
        );
        for(i = 0; i < len; i = i.add(1))
        {
            if (array[i] == toFind)
                return i;
        }
    }
}
