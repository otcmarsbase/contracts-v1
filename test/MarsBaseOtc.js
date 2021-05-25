const BN = require("bn.js");
const chai = require("chai");
const { expect, assert } = require("chai");
const expectRevert = require("./utils/expectRevert.js");
const helper = require("openzeppelin-test-helpers/src/time.js");
const time = require("openzeppelin-test-helpers/src/time.js");
const assertArrays = require('chai-arrays');
const { web3 } = require("openzeppelin-test-helpers/src/setup");
chai.use(assertArrays);
chai.use(require("chai-bn")(BN));

require('dotenv').config();
const {
} = process.env;

const MINUS_ONE = new BN(-1);
const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);
const FOUR = new BN(4);
const FIVE = new BN(5);
const SIX = new BN(6);
const SEVEN = new BN(7);
const EIGHT = new BN(8);
const NINE = new BN(9);
const TEN = new BN(10);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const DECIMALS = new BN(8);
const ONE_TOKEN = TEN.pow(DECIMALS);
const ONE_ETH = TEN.pow(new BN(18));
const TOTAL_SUPPLY = ONE_TOKEN.mul(new BN(100));

const TIME_DELTA_FOR_KEY = new BN(60 * 60);

const MarsBaseOtc = artifacts.require('MarsBaseOtc');
const Vault = artifacts.require('Vault');
const testToken = artifacts.require('testToken');

contract(
    'MarsBaseOtc-test',
    ([
        MarsBaseOtcOwner,
        VaultOwner,
        user1,
        user2,
        user3,
        user4,
        ownerBroker,
        usersBroker
    ]) => {
        let VaultInst;
        let MarsBaseOtcInst;

        let TestTokenInst_1;
        let TestTokenInst_2;
        let WhiteListTestTokenInst_1;
        let WhiteListTestTokenInst_2;

        let orderExpirationDate;

        beforeEach(async () => {
            // Init contracts

            VaultInst = await Vault.new(
                { from: VaultOwner }
            );

            MarsBaseOtcInst = await MarsBaseOtc.new(
                { from: MarsBaseOtcOwner }
            );

            await VaultInst.setMarsBaseOtc(MarsBaseOtcInst.address, { from: VaultOwner });
            await MarsBaseOtcInst.setVault(VaultInst.address, { from: MarsBaseOtcOwner });

            TestTokenInst_1 = await testToken.new(
                "Name 1",
                "Symbol 1",
                TOTAL_SUPPLY,
                DECIMALS,
                { from: user1 }
            );

            TestTokenInst_2 = await testToken.new(
                "Name 2",
                "Symbol 2",
                TOTAL_SUPPLY,
                DECIMALS,
                { from: user2 }
            );

            WhiteListTestTokenInst_1 = await testToken.new(
                "WL Name 1",
                "WL Symbol 1",
                TOTAL_SUPPLY,
                DECIMALS,
                { from: user1 }
            );

            WhiteListTestTokenInst_2 = await testToken.new(
                "WL Name 2",
                "WL Symbol 2",
                TOTAL_SUPPLY,
                DECIMALS,
                { from: user2 }
            );

            await MarsBaseOtcInst.addWhiteList(WhiteListTestTokenInst_1.address);
            await MarsBaseOtcInst.addWhiteList(WhiteListTestTokenInst_2.address);

            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
        })

        it("#0 Deploy test", async () => {
            expect(await VaultInst.marsBaseOtc()).to.be.equals(MarsBaseOtcInst.address);
            expect(await VaultInst.owner()).to.be.equals(VaultOwner);

            expect(await MarsBaseOtcInst.vault()).to.be.equals(VaultInst.address);
            expect(await MarsBaseOtcInst.owner()).to.be.equals(MarsBaseOtcOwner);
            expect(await MarsBaseOtcInst.isAddressInWhiteList(WhiteListTestTokenInst_1.address)).to.be.equals(true);
            expect(await MarsBaseOtcInst.isAddressInWhiteList(WhiteListTestTokenInst_2.address)).to.be.equals(true);

            expect(await TestTokenInst_1.name()).to.be.equals("Name 1");
            expect(await TestTokenInst_1.symbol()).to.be.equals("Symbol 1");
            expect(await TestTokenInst_1.decimals()).to.be.bignumber.that.equals(DECIMALS);
            expect(await TestTokenInst_1.totalSupply()).to.be.bignumber.that.equals(TOTAL_SUPPLY);
            expect(await TestTokenInst_1.balanceOf(user1)).to.be.bignumber.that.equals(TOTAL_SUPPLY);
        })

        it("#1 Test order creation", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test creation buy orders
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            expect((await MarsBaseOtcInst.orders(key)).owner).to.be.equals(user1);
            expect((await MarsBaseOtcInst.orders(key)).token).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.orders(key)).amountOfToken).to.be.bignumber.that.equals(amount1);
            expect((await MarsBaseOtcInst.orders(key)).discount).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.orders(key)).isCancelled).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).isSwapped).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).orderType).to.be.bignumber.that.equals(ONE);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ZERO);

            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            await MarsBaseOtcInst.createOrder(
                key,
                ZERO_ADDRESS,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            expect((await MarsBaseOtcInst.orders(key)).owner).to.be.equals(user1);
            expect((await MarsBaseOtcInst.orders(key)).token).to.be.equals(ZERO_ADDRESS);
            expect((await MarsBaseOtcInst.orders(key)).amountOfToken).to.be.bignumber.that.equals(amount1);
            expect((await MarsBaseOtcInst.orders(key)).discount).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.orders(key)).isCancelled).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).isSwapped).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).orderType).to.be.bignumber.that.equals(ONE);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ZERO);

            // test creation sell orders
            await helper.increase(TIME_DELTA_FOR_KEY);
            keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                TWO,
                false,
                { from: user1 }
            );

            expect((await MarsBaseOtcInst.orders(key)).owner).to.be.equals(user1);
            expect((await MarsBaseOtcInst.orders(key)).token).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.orders(key)).amountOfToken).to.be.bignumber.that.equals(amount1);
            expect((await MarsBaseOtcInst.orders(key)).discount).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.orders(key)).isCancelled).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).isSwapped).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).orderType).to.be.bignumber.that.equals(TWO);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ZERO);

            await helper.increase(TIME_DELTA_FOR_KEY);
            keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            await MarsBaseOtcInst.createOrder(
                key,
                ZERO_ADDRESS,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                TWO,
                false,
                { from: user1 }
            );

            expect((await MarsBaseOtcInst.orders(key)).owner).to.be.equals(user1);
            expect((await MarsBaseOtcInst.orders(key)).token).to.be.equals(ZERO_ADDRESS);
            expect((await MarsBaseOtcInst.orders(key)).amountOfToken).to.be.bignumber.that.equals(amount1);
            expect((await MarsBaseOtcInst.orders(key)).discount).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.orders(key)).isCancelled).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).isSwapped).to.be.equals(false);
            expect((await MarsBaseOtcInst.orders(key)).orderType).to.be.bignumber.that.equals(TWO);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ZERO);
        })

        it("#2 Test exceptions in creating orders", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            let block = await web3.eth.getBlock();
            let orderExpirationDateNew = new BN(block.timestamp);
            orderExpirationDateNew = orderExpirationDateNew.sub(ONE);
            await expectRevert(
                MarsBaseOtcInst.createOrder(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    orderExpirationDateNew,
                    ZERO_ADDRESS,
                    ZERO,
                    ZERO_ADDRESS,
                    ZERO,
                    ONE,
                    ONE,
                    false,
                    { from: user2 }
                ),
                "205"
            );

            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_1.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );
            await expectRevert(
                MarsBaseOtcInst.createOrder(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    orderExpirationDate,
                    ZERO_ADDRESS,
                    ZERO,
                    ZERO_ADDRESS,
                    ZERO,
                    ONE,
                    ONE,
                    false,
                    { from: user2 }
                ),
                "201"
            );

            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            await expectRevert(
                MarsBaseOtcInst.createOrder(
                    key,
                    TestTokenInst_1.address,
                    ZERO,
                    orderExpirationDate,
                    ZERO_ADDRESS,
                    ZERO,
                    ZERO_ADDRESS,
                    ZERO,
                    ONE,
                    ONE,
                    false,
                    { from: user1 }
                ),
                "202"
            );
            await expectRevert(
                MarsBaseOtcInst.createOrder(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    orderExpirationDate,
                    ZERO_ADDRESS,
                    ZERO,
                    ZERO_ADDRESS,
                    ZERO,
                    new BN("1000"),
                    ONE,
                    false,
                    { from: user1 }
                ),
                "203"
            );
        })

        it("#3 Test deposit into buy order", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            expect(await TestTokenInst_1.balanceOf(user2)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_1.balanceOf(user2)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(user1)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(user1)).to.be.bignumber.that.equals(ZERO);

            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount2,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ZERO,
                ONE,
                false,
                { from: user1 }
            );

            // first donation of WhiteListTestTokenInst_1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            let user1Token1AmountBefore = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                { from: user1 }
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).tokens)).to.be.eql(JSON.stringify([WhiteListTestTokenInst_1.address]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).amount)).to.be.eql(JSON.stringify([amount1]));

            let user1Token1AmountAfter = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(user1Token1AmountBefore.sub(user1Token1AmountAfter)).to.be.bignumber.that.equals(amount1);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            // first donation of WhiteListTestTokenInst_2
            await WhiteListTestTokenInst_2.transfer(user1, amount1, { from: user2 });
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            let user1Token2AmountBefore = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount1,
                { from: user1 }
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).tokens)).to.be.equals(JSON.stringify([
                WhiteListTestTokenInst_1.address,
                WhiteListTestTokenInst_2.address
            ]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).amount)).to.be.equals(JSON.stringify([
                amount1,
                amount1
            ]));

            let user1Token2AmountAfter = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(user1Token2AmountBefore.sub(user1Token2AmountAfter)).to.be.bignumber.that.equals(amount1);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(TWO);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).investedToken).to.be.equals(WhiteListTestTokenInst_2.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(amount1);

            // second donation of WhiteListTestTokenInst_1
            user1Token1AmountBefore = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                { from: user1 }
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).tokens)).to.be.equals(JSON.stringify([
                WhiteListTestTokenInst_1.address,
                WhiteListTestTokenInst_2.address
            ]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).amount)).to.be.equals(JSON.stringify([
                amount1.mul(TWO),
                amount1
            ]));

            user1Token1AmountAfter = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1.mul(TWO));
            expect(user1Token1AmountBefore.sub(user1Token1AmountAfter)).to.be.bignumber.that.equals(amount1);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(THREE);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).investedToken).to.be.equals(WhiteListTestTokenInst_2.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, TWO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, TWO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, TWO)).amountInvested).to.be.bignumber.that.equals(amount1);

            // first donation of ETH
            await MarsBaseOtcInst.addWhiteList(ZERO_ADDRESS, { from: MarsBaseOtcOwner });
            let user1EthAmountBefore = new BN(await web3.eth.getBalance(user1));
            expect(new BN(await web3.eth.getBalance(VaultInst.address))).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.orderDeposit(
                key,
                ZERO_ADDRESS,
                ONE_ETH,
                { from: user1, value: ONE_ETH, gasPrice: ZERO }
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).tokens)).to.be.equals(JSON.stringify([
                WhiteListTestTokenInst_1.address,
                WhiteListTestTokenInst_2.address,
                ZERO_ADDRESS
            ]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).amount)).to.be.equals(JSON.stringify([
                amount1.mul(TWO),
                amount1,
                ONE_ETH
            ]));

            let user1EthAmountAfter = new BN(await web3.eth.getBalance(user1));
            expect(new BN(await web3.eth.getBalance(VaultInst.address))).to.be.bignumber.that.equals(ONE_ETH);
            expect(user1EthAmountBefore.sub(user1EthAmountAfter)).to.be.bignumber.that.equals(ONE_ETH);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(FOUR);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).investedToken).to.be.equals(WhiteListTestTokenInst_2.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, TWO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, TWO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, TWO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, THREE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, THREE)).investedToken).to.be.equals(ZERO_ADDRESS);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, THREE)).amountInvested).to.be.bignumber.that.equals(ONE_ETH);

            // first user2 deposit of TestTokenInst_2
            let firstDeposit = amount2.div(THREE);
            let secondDeposit = amount2.sub(firstDeposit);
            assert(firstDeposit.add(secondDeposit).lte(TOTAL_SUPPLY));
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            let user2Token1AmountBefore = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                firstDeposit,
                { from: user2 }
            );
            let user2Token1AmountAfter = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(firstDeposit);
            expect(user2Token1AmountBefore.sub(user2Token1AmountAfter)).to.be.bignumber.that.equals(firstDeposit);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investedToken).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(firstDeposit);

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2
            ]));

            // second user2 deposit of TestTokenInst_2
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                secondDeposit,
                { from: user2 }
            );

            user2Token1AmountAfter = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(user2Token1AmountBefore.sub(user2Token1AmountAfter)).to.be.bignumber.that.equals(amount2);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(TWO);

            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investedToken).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(firstDeposit);

            expect((await MarsBaseOtcInst.ordersBid(key, ONE)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.ordersBid(key, ONE)).investedToken).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.ordersBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(secondDeposit);

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2
            ]));

            await TestTokenInst_2.transfer(user3, amount2, { from: user2 });
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2,
                user3
            ]));

            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2,
                user3
            ]));
        })

        it("#4 Test deposit into sell order", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            expect(await TestTokenInst_1.balanceOf(user2)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_1.balanceOf(user2)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(user1)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(user1)).to.be.bignumber.that.equals(ZERO);

            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_1.address,
                amount2,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ZERO,
                TWO, // sell
                false,
                { from: user1 }
            );

            // first donation of WhiteListTestTokenInst_1
            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            let user1Token1AmountBefore = new BN(await TestTokenInst_1.balanceOf(user1));
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_1.address,
                amount1,
                { from: user1 }
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).tokens)).to.be.eql(JSON.stringify([TestTokenInst_1.address]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).amount)).to.be.eql(JSON.stringify([amount1]));

            let user1Token1AmountAfter = new BN(await TestTokenInst_1.balanceOf(user1));
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(user1Token1AmountBefore.sub(user1Token1AmountAfter)).to.be.bignumber.that.equals(amount1);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investedToken).to.be.equals(TestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            await WhiteListTestTokenInst_1.transfer(user2, amount1, { from: user1 });
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            let user2Token1AmountBefore = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                { from: user2 }
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderUserInvestments(key, user2)).tokens)).to.be.equals(JSON.stringify([
                WhiteListTestTokenInst_1.address
            ]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderUserInvestments(key, user2)).amount)).to.be.equals(JSON.stringify([
                amount1
            ]));

            let user2Token1AmountAfter = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(user2Token1AmountBefore.sub(user2Token1AmountAfter)).to.be.bignumber.that.equals(amount1);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(ONE);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ONE);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investedToken).to.be.equals(TestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            let user2Token2AmountBefore = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderUserInvestments(key, user2)).tokens)).to.be.equals(JSON.stringify([
                WhiteListTestTokenInst_1.address,
                WhiteListTestTokenInst_2.address
            ]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderUserInvestments(key, user2)).amount)).to.be.equals(JSON.stringify([
                amount1,
                amount2
            ]));

            user2Token2AmountAfter = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(user2Token2AmountBefore.sub(user2Token2AmountAfter)).to.be.bignumber.that.equals(amount2);

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(TWO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ONE);

            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).investedToken).to.be.equals(TestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.ordersBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.ordersBid(key, ONE)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.ordersBid(key, ONE)).investedToken).to.be.equals(WhiteListTestTokenInst_2.address);
            expect((await MarsBaseOtcInst.ordersBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(amount2);

            await WhiteListTestTokenInst_2.transfer(user3, amount2, { from: user2 });
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2,
                user3
            ]));

            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2,
                user3
            ]));
        })

        it("#5 Test exceptions in depositing orders", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test depositing in buy orders
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );


            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    await MarsBaseOtcInst.createKey(user2),
                    TestTokenInst_2.address,
                    amount1,
                    { from: user1 }
                ),
                "102"
            );

            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    TestTokenInst_2.address,
                    amount1,
                    { from: user1, value: ONE }
                ),
                "305"
            );

            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    WhiteListTestTokenInst_1.address,
                    amount1,
                    { from: user1 }
                ),
                "306"
            );

            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    { from: user1 }
                ),
                "308"
            );

            await TestTokenInst_1.transfer(
                user2,
                amount1,
                { from: user1 }
            );
            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    { from: user2 }
                ),
                "309"
            );

            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    ZERO_ADDRESS,
                    ONE_ETH,
                    { from: user2, value: ONE_ETH.add(ONE) }
                ),
                "304"
            );
            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    ZERO_ADDRESS,
                    ONE_ETH,
                    { from: user2, value: ONE_ETH.sub(ONE) }
                ),
                "304"
            );


            // test deposit in sell order
            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            await MarsBaseOtcInst.createOrder(
                key,
                ZERO_ADDRESS,
                ONE_ETH,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                TWO,
                false,
                { from: user1 }
            );


            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    { from: user1 }
                ),
                "310"
            );

            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    TestTokenInst_2.address,
                    amount1,
                    { from: user2 }
                ),
                "311"
            );
        })

        it("#6 Test swap function", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test depositing in buy orders
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            // user1 depositing
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount2,
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount2,
                { from: user1 }
            );

            // user2 depositing
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            // user3 depositing
            await TestTokenInst_2.transfer(
                user3,
                amount1,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user3 }
            );

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1.add(amount2));

            // swapping
            let user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            let WhiteListTestToken1Investments = amount1;
            let toUser2WhiteListTestToken1 = WhiteListTestToken1Investments.div(THREE);
            let toUser1WhiteListTestToken1 = WhiteListTestToken1Investments.sub(toUser2WhiteListTestToken1).div(TWO);
            let toUser3WhiteListTestToken1 = WhiteListTestToken1Investments.sub(toUser2WhiteListTestToken1).sub(toUser1WhiteListTestToken1);

            let WhiteListTestToken2Investments = amount2;
            let toUser2WhiteListTestToken2 = WhiteListTestToken2Investments.div(FOUR);
            let toUser1WhiteListTestToken2 = WhiteListTestToken2Investments.sub(toUser2WhiteListTestToken2).div(THREE);
            let toUser3WhiteListTestToken2 = WhiteListTestToken2Investments.sub(toUser2WhiteListTestToken2).sub(toUser1WhiteListTestToken2);

            let distribution = [
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: toUser2WhiteListTestToken1.toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: toUser3WhiteListTestToken2.toString()
                },
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: toUser2WhiteListTestToken2.toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: toUser3WhiteListTestToken1.toString()
                },
                {
                    investor: user3,
                    investedToken: TestTokenInst_2.address,
                    amountInvested: amount1.div(THREE).toString()
                },
                {
                    investor: user2,
                    investedToken: TestTokenInst_2.address,
                    amountInvested: amount2.div(FOUR).toString()
                },
                {
                    investor: user1,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: toUser1WhiteListTestToken1.toString()
                },
                {
                    investor: user1,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: toUser1WhiteListTestToken2.toString()
                },
            ];
            await MarsBaseOtcInst.makeSwap(key, distribution, { from: MarsBaseOtcOwner });

            let user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));


            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(toUser1WhiteListTestToken1);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(toUser1WhiteListTestToken2);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(amount1.sub(amount1.div(THREE)).add(amount2).sub(amount2.div(FOUR)));

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(toUser2WhiteListTestToken1);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(toUser2WhiteListTestToken2);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(amount2.div(FOUR));

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(toUser3WhiteListTestToken1);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(toUser3WhiteListTestToken2);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(amount1.div(THREE));

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
        })

        it("#7 Test exceptions in swapping orders", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test depositing in buy orders
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );


            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    await MarsBaseOtcInst.createKey(user2),
                    [],
                    { from: MarsBaseOtcOwner }
                ),
                "102"
            );

            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    [],
                    { from: user1 }
                ),
                "Ownable: caller is not the owner"
            );
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    [
                        {
                            investor: user3,
                            investedToken: WhiteListTestTokenInst_2.address,
                            amountInvested: amount1.toString()
                        }
                    ],
                    { from: MarsBaseOtcOwner }
                ),
                "506"
            );

            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user2 }
            );
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    [],
                    { from: MarsBaseOtcOwner }
                ),
                "505"
            );
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    [
                        {
                            investor: user3,
                            investedToken: WhiteListTestTokenInst_2.address,
                            amountInvested: amount1.toString()
                        }
                    ],
                    { from: MarsBaseOtcOwner }
                ),
                "507"
            );

            // user1 depositing
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount2,
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount2,
                { from: user1 }
            );

            // user3 depositing
            await TestTokenInst_2.transfer(
                user3,
                amount1,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user3 }
            );

            let WhiteListTestToken1Investments = amount1;
            let toUser2WhiteListTestToken1 = WhiteListTestToken1Investments.div(THREE);
            let toUser3WhiteListTestToken1 = WhiteListTestToken1Investments.sub(toUser2WhiteListTestToken1);

            let WhiteListTestToken2Investments = amount2;
            let toUser2WhiteListTestToken2 = WhiteListTestToken2Investments.div(FOUR);
            let toUser3WhiteListTestToken2 = WhiteListTestToken2Investments.sub(toUser2WhiteListTestToken2);

            let distribution = [
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: toUser2WhiteListTestToken1.toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: toUser3WhiteListTestToken2.toString()
                },
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: toUser2WhiteListTestToken2.toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: toUser3WhiteListTestToken1.toString()
                },
            ];
            distribution[0].investedToken = user3;
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    distribution,
                    { from: MarsBaseOtcOwner }
                ),
                "509"
            );
            distribution[0].investedToken = WhiteListTestTokenInst_1.address;

            distribution[0].amountInvested = ((new BN(distribution[0].amountInvested)).add(ONE)).toString();
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    distribution,
                    { from: MarsBaseOtcOwner }
                ),
                "511"
            );
            distribution[0].amountInvested = ((new BN(distribution[0].amountInvested)).sub(ONE)).toString();

            distribution[0].amountInvested = ((new BN(distribution[0].amountInvested)).sub(ONE)).toString();
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    distribution,
                    { from: MarsBaseOtcOwner }
                ),
                "512"
            );
            distribution[0].amountInvested = ((new BN(distribution[0].amountInvested)).add(ONE)).toString();

            distribution[0].investor = user4;
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    distribution,
                    { from: MarsBaseOtcOwner }
                ),
                "508"
            );
            distribution[0].investor = user2;

            await MarsBaseOtcInst.makeSwap(
                key,
                distribution,
                { from: MarsBaseOtcOwner }
            );
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    distribution,
                    { from: MarsBaseOtcOwner }
                ),
                "502"
            );


            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );
            await MarsBaseOtcInst.cancel(key);
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    [],
                    { from: MarsBaseOtcOwner }
                ),
                "501"
            );
        })

        it("#8 Test canceling orders", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test depositing in buy orders
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            //user2 depositing
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            // user1 depositing
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount2,
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount2,
                { from: user1 }
            );

            // user3 depositing
            await TestTokenInst_2.transfer(
                user3,
                amount1,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user3 }
            );

            // canceling
            let user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            await MarsBaseOtcInst.cancel(key);

            let user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(amount1);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(amount2);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(amount2);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(amount1);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
        })

        it("#9 Test exceptions in canceling orders", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test depositing in buy orders
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            await expectRevert(
                MarsBaseOtcInst.cancel(
                    key,
                    { from: user2 }
                ),
                "403"
            );
            await MarsBaseOtcInst.cancel(
                key,
                { from: user1 }
            );
            await expectRevert(
                MarsBaseOtcInst.cancel(
                    key,
                    { from: user1 }
                ),
                "401"
            );

            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            //user2 depositing
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            // user1 depositing
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount2,
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount2,
                { from: user1 }
            );

            // user3 depositing
            await TestTokenInst_2.transfer(
                user3,
                amount1,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user3 }
            );

            let WhiteListTestToken1Investments = amount1;
            let toUser2WhiteListTestToken1 = WhiteListTestToken1Investments.div(THREE);
            let toUser3WhiteListTestToken1 = WhiteListTestToken1Investments.sub(toUser2WhiteListTestToken1);

            let WhiteListTestToken2Investments = amount2;
            let toUser2WhiteListTestToken2 = WhiteListTestToken2Investments.div(FOUR);
            let toUser3WhiteListTestToken2 = WhiteListTestToken2Investments.sub(toUser2WhiteListTestToken2);

            let distribution = [
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: toUser2WhiteListTestToken1.toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: toUser3WhiteListTestToken2.toString()
                },
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: toUser2WhiteListTestToken2.toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: toUser3WhiteListTestToken1.toString()
                },
            ];
            await MarsBaseOtcInst.makeSwap(
                key,
                distribution,
                { from: MarsBaseOtcOwner }
            );
            await expectRevert(
                MarsBaseOtcInst.cancel(
                    key,
                    { from: MarsBaseOtcOwner }
                ),
                "402"
            );
        })

        it("#10 Test expiration date", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            let block = await web3.eth.getBlock();
            let orderExpirationDateNew = new BN(block.timestamp);
            orderExpirationDateNew = orderExpirationDateNew.sub(ONE);
            await expectRevert(
                MarsBaseOtcInst.createOrder(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    orderExpirationDateNew,
                    ZERO_ADDRESS,
                    ZERO,
                    ZERO_ADDRESS,
                    ZERO,
                    ONE,
                    ONE,
                    false,
                    { from: user1 }
                ),
                "205"
            );

            // test depositing in buy orders
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );

            await time.increaseTo(orderExpirationDate.add(TEN));
            assert((new BN(await MarsBaseOtcInst.contractTimestamp())).gt(orderExpirationDate));
            //expect(await MarsBaseOtcInst.contractTimestamp()).to.be.bignumber.that.equals(orderExpirationDate.add(ONE));

            // test deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    WhiteListTestTokenInst_1.address,
                    amount2,
                    { from: user1 }
                ),
                "303"
            );
            // test deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await expectRevert(
                MarsBaseOtcInst.orderDeposit(
                    key,
                    TestTokenInst_2.address,
                    amount1,
                    { from: user2 }
                ),
                "303"
            );

            let distribution = [
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: amount1
                },

            ];
            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    distribution,
                    { from: MarsBaseOtcOwner }
                ),
                "504"
            );

            await MarsBaseOtcInst.cancel(key, { from: MarsBaseOtcOwner });
        })

        it("#11 Test manual orders", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test depositing in buy orders
            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                true,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            let user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            await MarsBaseOtcInst.makeSwapOrderOwner(key, ZERO, { from: user1 });

            let user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(amount1);

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(amount2);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(amount2);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);

            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                true,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            await MarsBaseOtcInst.makeSwapOrderOwner(key, ONE, { from: user1 });

            user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(amount2);

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(amount1);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(amount2);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
        })

        it("#12 Test exception in making swap of manual order", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            // test depositing in buy orders
            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                true,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            await expectRevert(
                MarsBaseOtcInst.makeSwap(
                    key,
                    [],
                    { from: MarsBaseOtcOwner }
                ),
                "503"
            );
            await MarsBaseOtcInst.cancel(key, { from: user1 });



            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            await expectRevert(
                MarsBaseOtcInst.makeSwapOrderOwner(
                    key,
                    ZERO,
                    { from: user1 }
                ),
                "603"
            );
        })

        it("#13 Test brokers", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            let ownerBrokerPerc = new BN("100");
            let usersBrokerPerc = new BN("200");

            // test depositing in buy orders
            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ownerBroker,
                ownerBrokerPerc,
                usersBroker,
                usersBrokerPerc,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount1,
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount1,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            let user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            let ownerBrokerWhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerWhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(ownerBroker));
            let ownerBrokerToken1Before = new BN(await TestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerToken2Before = new BN(await TestTokenInst_2.balanceOf(ownerBroker));

            let usersBrokerWhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerWhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(usersBroker));
            let usersBrokerToken1Before = new BN(await TestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerToken2Before = new BN(await TestTokenInst_2.balanceOf(usersBroker));

            let distribution = [
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: amount2.div(TWO).toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: amount2.sub(amount2.div(TWO)).toString()
                },
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: amount1.div(TWO).toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: amount1.sub(amount1.div(TWO)).toString()
                },
            ];

            let denominator = new BN(await MarsBaseOtcInst.BROKERS_DENOMINATOR());
            let toUserBrokerWhiteListToken1 = amount2.mul(usersBrokerPerc).div(denominator);
            let toUsersWhiteListToken1 = amount2.sub(toUserBrokerWhiteListToken1);
            let toUserBrokerWhiteListToken2 = amount1.mul(usersBrokerPerc).div(denominator);
            let toUsersWhiteListToken2 = amount1.sub(toUserBrokerWhiteListToken2);

            let testToken1Invested = amount1.add(amount2);
            let toOwnerBrokerTestToken2 = testToken1Invested.mul(ownerBrokerPerc).div(denominator);
            let toOwnerTestToken2 = testToken1Invested.sub(toOwnerBrokerTestToken2);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);

            await MarsBaseOtcInst.makeSwap(key, distribution, { from: MarsBaseOtcOwner });

            let user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            let ownerBrokerWhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerWhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(ownerBroker));
            let ownerBrokerToken1After = new BN(await TestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerToken2After = new BN(await TestTokenInst_2.balanceOf(ownerBroker));

            let usersBrokerWhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerWhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(usersBroker));
            let usersBrokerToken1After = new BN(await TestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerToken2After = new BN(await TestTokenInst_2.balanceOf(usersBroker));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(toOwnerTestToken2);

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(toUsersWhiteListToken1.div(TWO));
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(toUsersWhiteListToken2.div(TWO));
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(toUsersWhiteListToken1.div(TWO));
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(toUsersWhiteListToken2.div(TWO));
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(ownerBrokerWhiteListToken1After.sub(ownerBrokerWhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(ownerBrokerWhiteListToken2After.sub(ownerBrokerWhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(ownerBrokerToken1After.sub(ownerBrokerToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(ownerBrokerToken2After.sub(ownerBrokerToken2Before)).to.be.bignumber.that.equals(toOwnerBrokerTestToken2);

            expect(usersBrokerWhiteListToken1After.sub(usersBrokerWhiteListToken1Before)).to.be.bignumber.that.equals(toUserBrokerWhiteListToken1);
            expect(usersBrokerWhiteListToken2After.sub(usersBrokerWhiteListToken2Before)).to.be.bignumber.that.equals(toUserBrokerWhiteListToken2);
            expect(usersBrokerToken1After.sub(usersBrokerToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(usersBrokerToken2After.sub(usersBrokerToken2Before)).to.be.bignumber.that.equals(ZERO);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
        })

        it("#14 Test brokers in manual order", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            let ownerBrokerPerc = new BN("100");
            let usersBrokerPerc = new BN("200");

            // test depositing in buy orders
            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ownerBroker,
                ownerBrokerPerc,
                usersBroker,
                usersBrokerPerc,
                ONE,
                ONE,
                true,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount1,
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount1,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );

            let user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            let ownerBrokerWhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerWhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(ownerBroker));
            let ownerBrokerToken1Before = new BN(await TestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerToken2Before = new BN(await TestTokenInst_2.balanceOf(ownerBroker));

            let usersBrokerWhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerWhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(usersBroker));
            let usersBrokerToken1Before = new BN(await TestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerToken2Before = new BN(await TestTokenInst_2.balanceOf(usersBroker));

            let denominator = new BN(await MarsBaseOtcInst.BROKERS_DENOMINATOR());
            let toUserBrokerWhiteListToken1 = amount2.mul(usersBrokerPerc).div(denominator);
            let toUsersWhiteListToken1 = amount2.sub(toUserBrokerWhiteListToken1);
            let toUserBrokerWhiteListToken2 = amount1.mul(usersBrokerPerc).div(denominator);
            let toUsersWhiteListToken2 = amount1.sub(toUserBrokerWhiteListToken2);

            let testToken1Invested = amount1;
            let toOwnerBrokerTestToken2 = testToken1Invested.mul(ownerBrokerPerc).div(denominator);
            let toOwnerTestToken2 = testToken1Invested.sub(toOwnerBrokerTestToken2);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);

            await MarsBaseOtcInst.makeSwapOrderOwner(key, ZERO, { from: user1 });

            let user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            let ownerBrokerWhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerWhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(ownerBroker));
            let ownerBrokerToken1After = new BN(await TestTokenInst_1.balanceOf(ownerBroker));
            let ownerBrokerToken2After = new BN(await TestTokenInst_2.balanceOf(ownerBroker));

            let usersBrokerWhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerWhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(usersBroker));
            let usersBrokerToken1After = new BN(await TestTokenInst_1.balanceOf(usersBroker));
            let usersBrokerToken2After = new BN(await TestTokenInst_2.balanceOf(usersBroker));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(toOwnerTestToken2);

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(toUsersWhiteListToken1);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(toUsersWhiteListToken2);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(amount2);

            expect(ownerBrokerWhiteListToken1After.sub(ownerBrokerWhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(ownerBrokerWhiteListToken2After.sub(ownerBrokerWhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(ownerBrokerToken1After.sub(ownerBrokerToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(ownerBrokerToken2After.sub(ownerBrokerToken2Before)).to.be.bignumber.that.equals(toOwnerBrokerTestToken2);

            expect(usersBrokerWhiteListToken1After.sub(usersBrokerWhiteListToken1Before)).to.be.bignumber.that.equals(toUserBrokerWhiteListToken1);
            expect(usersBrokerWhiteListToken2After.sub(usersBrokerWhiteListToken2Before)).to.be.bignumber.that.equals(toUserBrokerWhiteListToken2);
            expect(usersBrokerToken1After.sub(usersBrokerToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(usersBrokerToken2After.sub(usersBrokerToken2Before)).to.be.bignumber.that.equals(ZERO);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
        })

        it("#15 Test cancel bid", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            let ownerBrokerPerc = new BN("100");
            let usersBrokerPerc = new BN("200");

            // test depositing in buy orders
            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount1,
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount1,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            let user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1.add(amount2.mul(TWO)));

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(THREE);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(TWO);

            await expectRevert(
                MarsBaseOtcInst.cancelBid(key, ONE, { from: user2 }),
                "702"
            );
            await MarsBaseOtcInst.cancelBid(key, ONE, { from: user1 });
            await MarsBaseOtcInst.cancelBid(key, ONE, { from: user3 });

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(TWO);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(ONE);

            let user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(amount1);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(amount2);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1.add(amount2));

            user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            let distribution = [
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: amount2.toString()
                }
            ];
            await MarsBaseOtcInst.makeSwap(key, distribution, { from: MarsBaseOtcOwner });

            user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(amount1.add(amount2));

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(amount2);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
        })

        it("#16 Test change bid", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            let ownerBrokerPerc = new BN("100");
            let usersBrokerPerc = new BN("200");

            // test depositing in buy orders
            orderExpirationDate = new BN(await MarsBaseOtcInst.contractTimestamp());
            orderExpirationDate = orderExpirationDate.add(new BN("86400"));
            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                orderExpirationDate,
                ZERO_ADDRESS,
                ZERO,
                ZERO_ADDRESS,
                ZERO,
                ONE,
                ONE,
                false,
                { from: user1 }
            );

            // deposit user1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount2,
                { from: user1 }
            );
            await WhiteListTestTokenInst_2.transfer(
                user1,
                amount2.mul(THREE),
                { from: user2 }
            );
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2.mul(THREE),
                { from: user1 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount1,
                { from: user1 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount1,
                { from: user2 }
            );
            // deposit user3
            await TestTokenInst_2.transfer(
                user3,
                amount2,
                { from: user2 }
            );
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user3 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user3 }
            );
            // deposit user2
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                { from: user2 }
            );
            await MarsBaseOtcInst.orderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                { from: user2 }
            );

            let user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1.add(amount2.mul(TWO)));

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(THREE);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(TWO);

            await expectRevert(
                MarsBaseOtcInst.changeBid(key, ONE, amount1, { from: user2 }),
                "803"
            );
            await MarsBaseOtcInst.changeBid(key, ZERO, amount1.div(TWO), { from: user1 });
            await MarsBaseOtcInst.changeBid(key, ONE, amount2.mul(THREE), { from: user1 });
            await MarsBaseOtcInst.changeBid(key, ONE, amount1, { from: user3 });
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2.sub(amount1),
                { from: user2 }
            );
            await MarsBaseOtcInst.changeBid(key, ZERO, amount2, { from: user2 });

            expect(await MarsBaseOtcInst.ordersBidLen(key)).to.be.bignumber.that.equals(THREE);
            expect(await MarsBaseOtcInst.ordersOwnerBidLen(key)).to.be.bignumber.that.equals(TWO);

            let user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            let user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            let user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            let user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            let user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            let user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            let user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            let user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            let user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            let user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            let user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            let user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(amount2.sub(amount1.div(TWO)));
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(amount1.sub(amount2.mul(THREE)));
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(amount1.sub(amount2));

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(amount2.sub(amount1));

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1.div(TWO));
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2.mul(THREE));
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1.add(amount2.mul(TWO)));

            user1WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            user1WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            user1Token1Before = new BN(await TestTokenInst_1.balanceOf(user1));
            user1Token2Before = new BN(await TestTokenInst_2.balanceOf(user1));

            user2WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            user2WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            user2Token1Before = new BN(await TestTokenInst_1.balanceOf(user2));
            user2Token2Before = new BN(await TestTokenInst_2.balanceOf(user2));

            user3WhiteListToken1Before = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            user3WhiteListToken2Before = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            user3Token1Before = new BN(await TestTokenInst_1.balanceOf(user3));
            user3Token2Before = new BN(await TestTokenInst_2.balanceOf(user3));

            let distribution = [
                {
                    investor: user2,
                    investedToken: WhiteListTestTokenInst_1.address,
                    amountInvested: amount1.div(TWO).toString()
                },
                {
                    investor: user3,
                    investedToken: WhiteListTestTokenInst_2.address,
                    amountInvested: amount2.mul(THREE).toString()
                }
            ];
            await MarsBaseOtcInst.makeSwap(key, distribution, { from: MarsBaseOtcOwner });

            user1WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            user1WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            user1Token1After = new BN(await TestTokenInst_1.balanceOf(user1));
            user1Token2After = new BN(await TestTokenInst_2.balanceOf(user1));

            user2WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user2));
            user2WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user2));
            user2Token1After = new BN(await TestTokenInst_1.balanceOf(user2));
            user2Token2After = new BN(await TestTokenInst_2.balanceOf(user2));

            user3WhiteListToken1After = new BN(await WhiteListTestTokenInst_1.balanceOf(user3));
            user3WhiteListToken2After = new BN(await WhiteListTestTokenInst_2.balanceOf(user3));
            user3Token1After = new BN(await TestTokenInst_1.balanceOf(user3));
            user3Token2After = new BN(await TestTokenInst_2.balanceOf(user3));

            expect(user1WhiteListToken1After.sub(user1WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1WhiteListToken2After.sub(user1WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token1After.sub(user1Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user1Token2After.sub(user1Token2Before)).to.be.bignumber.that.equals(amount1.add(amount2.mul(TWO)));

            expect(user2WhiteListToken1After.sub(user2WhiteListToken1Before)).to.be.bignumber.that.equals(amount1.div(TWO));
            expect(user2WhiteListToken2After.sub(user2WhiteListToken2Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1After.sub(user2Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token2After.sub(user2Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(user3WhiteListToken1After.sub(user3WhiteListToken1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3WhiteListToken2After.sub(user3WhiteListToken2Before)).to.be.bignumber.that.equals(amount2.mul(THREE));
            expect(user3Token1After.sub(user3Token1Before)).to.be.bignumber.that.equals(ZERO);
            expect(user3Token2After.sub(user3Token2Before)).to.be.bignumber.that.equals(ZERO);

            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
        })
    }
)
