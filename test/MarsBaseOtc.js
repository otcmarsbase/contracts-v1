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
        user3
    ]) => {
        let VaultInst;
        let MarsBaseOtcInst;

        let TestTokenInst_1;
        let TestTokenInst_2;
        let WhiteListTestTokenInst_1;
        let WhiteListTestTokenInst_2;

        beforeEach(async () => {
            // Init contracts

            VaultInst = await Vault.new(
                {from: VaultOwner}
            );

            MarsBaseOtcInst = await MarsBaseOtc.new(
                {from: MarsBaseOtcOwner}
            );

            await VaultInst.setMarsBaseOtc(MarsBaseOtcInst.address, {from: VaultOwner});
            await MarsBaseOtcInst.setVault(VaultInst.address, {from: MarsBaseOtcOwner});

            TestTokenInst_1 = await testToken.new(
                "Name 1",
                "Symbol 1",
                TOTAL_SUPPLY,
                DECIMALS,
                {from: user1}
            );

            TestTokenInst_2 = await testToken.new(
                "Name 2",
                "Symbol 2",
                TOTAL_SUPPLY,
                DECIMALS,
                {from: user2}
            );

            WhiteListTestTokenInst_1 = await testToken.new(
                "WL Name 1",
                "WL Symbol 1",
                TOTAL_SUPPLY,
                DECIMALS,
                {from: user1}
            );

            WhiteListTestTokenInst_2 = await testToken.new(
                "WL Name 2",
                "WL Symbol 2",
                TOTAL_SUPPLY,
                DECIMALS,
                {from: user2}
            );

            await MarsBaseOtcInst.addWhiteList(WhiteListTestTokenInst_1.address);
            await MarsBaseOtcInst.addWhiteList(WhiteListTestTokenInst_2.address);
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

        it("#1 Test buy order creation", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            await MarsBaseOtcInst.createBuyOrder(
                key,
                TestTokenInst_2.address,
                amount1,
                ONE,
                {from: user1}
            );

            expect(await MarsBaseOtcInst.orderType(key)).to.be.bignumber.that.equals(ONE);

            expect((await MarsBaseOtcInst.buyOrders(key)).owner).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrders(key)).tokenToBuy).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.buyOrders(key)).amountOfTokensToBuy).to.be.bignumber.that.equals(amount1);
            expect((await MarsBaseOtcInst.buyOrders(key)).discount).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.buyOrders(key)).isCancelled).to.be.equals(false);
            expect((await MarsBaseOtcInst.buyOrders(key)).isSwapped).to.be.equals(false);

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.buyOrdersOwnerBidLen(key)).to.be.bignumber.that.equals(ZERO);

            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            await MarsBaseOtcInst.createBuyOrder(
                key,
                ZERO_ADDRESS,
                amount1,
                ONE,
                {from: user1}
            );

            expect(await MarsBaseOtcInst.orderType(key)).to.be.bignumber.that.equals(ONE);

            expect((await MarsBaseOtcInst.buyOrders(key)).owner).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrders(key)).tokenToBuy).to.be.equals(ZERO_ADDRESS);
            expect((await MarsBaseOtcInst.buyOrders(key)).amountOfTokensToBuy).to.be.bignumber.that.equals(amount1);
            expect((await MarsBaseOtcInst.buyOrders(key)).discount).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.buyOrders(key)).isCancelled).to.be.equals(false);
            expect((await MarsBaseOtcInst.buyOrders(key)).isSwapped).to.be.equals(false);

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.buyOrdersOwnerBidLen(key)).to.be.bignumber.that.equals(ZERO);
        })

        it("#2 Test exceptions in creating buy orders", async () => {
            let key = await MarsBaseOtcInst.createKey(user1);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            await MarsBaseOtcInst.createBuyOrder(
                key,
                TestTokenInst_1.address,
                amount1,
                ONE,
                {from: user1}
            );
            await expectRevert(
                MarsBaseOtcInst.createBuyOrder(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    ONE,
                    {from: user2}
                ),
                "MarsBaseOtc: Order already exists"
            );

            await helper.increase(TIME_DELTA_FOR_KEY);
            let keyNow = await MarsBaseOtcInst.createKey(user1);
            assert(keyNow != key);
            key = keyNow;

            await expectRevert(
                MarsBaseOtcInst.createBuyOrder(
                    key,
                    TestTokenInst_1.address,
                    ZERO,
                    ONE,
                    {from: user1}
                ),
                "MarsBaseOtc: Wrong amount to buy"
            );
            await expectRevert(
                MarsBaseOtcInst.createBuyOrder(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    new BN("1000"),
                    {from: user1}
                ),
                "MarsBaseOtc: Wrong discount"
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

            await MarsBaseOtcInst.createBuyOrder(
                key,
                TestTokenInst_2.address,
                amount2,
                ZERO,
                {from: user1}
            );

            // first donation of WhiteListTestTokenInst_1
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                {from: user1}
            );
            let user1Token1AmountBefore = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                {from: user1}
            );

            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).tokens)).to.be.eql(JSON.stringify([WhiteListTestTokenInst_1.address]));
            expect(JSON.stringify((await MarsBaseOtcInst.getOrderOwnerInvestments(key)).amount)).to.be.eql(JSON.stringify([amount1]));

            let user1Token1AmountAfter = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            expect(user1Token1AmountBefore.sub(user1Token1AmountAfter)).to.be.bignumber.that.equals(amount1);

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.buyOrdersOwnerBidLen(key)).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            // first donation of WhiteListTestTokenInst_2
            await WhiteListTestTokenInst_2.transfer(user1, amount1, {from: user2});
            await WhiteListTestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount1,
                {from: user1}
            );
            let user1Token2AmountBefore = new BN(await WhiteListTestTokenInst_2.balanceOf(user1));
            expect(await WhiteListTestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                WhiteListTestTokenInst_2.address,
                amount1,
                {from: user1}
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

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.buyOrdersOwnerBidLen(key)).to.be.bignumber.that.equals(TWO);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).investedToken).to.be.equals(WhiteListTestTokenInst_2.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(amount1);

            // second donation of WhiteListTestTokenInst_1
            user1Token1AmountBefore = new BN(await WhiteListTestTokenInst_1.balanceOf(user1));
            expect(await WhiteListTestTokenInst_1.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount1);
            await WhiteListTestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                {from: user1}
            );
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                WhiteListTestTokenInst_1.address,
                amount1,
                {from: user1}
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

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.buyOrdersOwnerBidLen(key)).to.be.bignumber.that.equals(THREE);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).investedToken).to.be.equals(WhiteListTestTokenInst_2.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, TWO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, TWO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, TWO)).amountInvested).to.be.bignumber.that.equals(amount1);

            // first donation of ETH
            await MarsBaseOtcInst.addWhiteList(ZERO_ADDRESS, {from: MarsBaseOtcOwner});
            let user1EthAmountBefore = new BN(await web3.eth.getBalance(user1));
            expect(new BN(await web3.eth.getBalance(VaultInst.address))).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                ZERO_ADDRESS,
                ONE_ETH,
                {from: user1, value: ONE_ETH, gasPrice: ZERO}
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

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(ZERO);
            expect(await MarsBaseOtcInst.buyOrdersOwnerBidLen(key)).to.be.bignumber.that.equals(FOUR);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).investedToken).to.be.equals(WhiteListTestTokenInst_2.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, TWO)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, TWO)).investedToken).to.be.equals(WhiteListTestTokenInst_1.address);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, TWO)).amountInvested).to.be.bignumber.that.equals(amount1);

            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, THREE)).investor).to.be.equals(user1);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, THREE)).investedToken).to.be.equals(ZERO_ADDRESS);
            expect((await MarsBaseOtcInst.buyOrdersOwnerBid(key, THREE)).amountInvested).to.be.bignumber.that.equals(ONE_ETH);

            // first user2 deposit of TestTokenInst_2
            let firstDeposit = amount2.div(THREE);
            let secondDeposit = amount2.sub(firstDeposit);
            assert(firstDeposit.add(secondDeposit).lte(TOTAL_SUPPLY));
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                {from: user2}
            );
            let user2Token1AmountBefore = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                TestTokenInst_2.address,
                firstDeposit,
                {from: user2}
            );
            let user2Token1AmountAfter = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(firstDeposit);
            expect(user2Token1AmountBefore.sub(user2Token1AmountAfter)).to.be.bignumber.that.equals(firstDeposit);

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(ONE);
            expect((await MarsBaseOtcInst.buyOrdersBid(key, ZERO)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.buyOrdersBid(key, ZERO)).investedToken).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.buyOrdersBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(firstDeposit);

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2
            ]));

            // second user2 deposit of TestTokenInst_2
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                TestTokenInst_2.address,
                secondDeposit,
                {from: user2}
            );

            user2Token1AmountAfter = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(amount2);
            expect(user2Token1AmountBefore.sub(user2Token1AmountAfter)).to.be.bignumber.that.equals(amount2);

            expect(await MarsBaseOtcInst.buyOrdersBidLen(key)).to.be.bignumber.that.equals(TWO);

            expect((await MarsBaseOtcInst.buyOrdersBid(key, ZERO)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.buyOrdersBid(key, ZERO)).investedToken).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.buyOrdersBid(key, ZERO)).amountInvested).to.be.bignumber.that.equals(firstDeposit);

            expect((await MarsBaseOtcInst.buyOrdersBid(key, ONE)).investor).to.be.equals(user2);
            expect((await MarsBaseOtcInst.buyOrdersBid(key, ONE)).investedToken).to.be.equals(TestTokenInst_2.address);
            expect((await MarsBaseOtcInst.buyOrdersBid(key, ONE)).amountInvested).to.be.bignumber.that.equals(secondDeposit);

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2
            ]));

            await TestTokenInst_2.transfer(user3, amount2, {from: user2});
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                {from: user3}
            );
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                {from: user3}
            );

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2,
                user3
            ]));

            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                {from: user2}
            );
            await MarsBaseOtcInst.buyOrderDeposit(
                key,
                TestTokenInst_2.address,
                amount2,
                {from: user2}
            );

            expect(JSON.stringify(await MarsBaseOtcInst.getInvestors(key))).to.be.equals(JSON.stringify([
                user2,
                user3
            ]));
        })

        /* it("#4 Test deposit into ETH/ERC20", async () => {
            let key = await MarsBaseOtcInst.createKey(orderOwner);

            let ethBalanceUser1BeforeOrder = new BN(await web3.eth.getBalance(user1));
            let ethBalanceUser2BeforeOrder = new BN(await web3.eth.getBalance(user2));
            expect(await TestTokenInst_2.balanceOf(user1)).to.be.bignumber.that.equals(ZERO);

            let amount1 = ONE_ETH.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(ethBalanceUser1BeforeOrder));
            assert(amount2.lte(TOTAL_SUPPLY));


            await MarsBaseOtcInst.createOrder(
                key,
                ZERO_ADDRESS,
                TestTokenInst_2.address,
                amount1,
                amount2,
                {from: orderOwner}
            );

            let user1Eth1AmountBefore = new BN(await web3.eth.getBalance(user1));
            expect(new BN(await web3.eth.getBalance(VaultInst.address))).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.deposit(
                key,
                ZERO_ADDRESS,
                amount1,
                {from: user1, value: amount1, gasPrice: ZERO}
            );

            let user1Eth1AmountAfter = new BN(await web3.eth.getBalance(user1));
            expect(new BN(await web3.eth.getBalance(VaultInst.address))).to.be.bignumber.that.equals(amount1);
            expect(user1Eth1AmountBefore.sub(user1Eth1AmountAfter)).to.be.bignumber.that.equals(amount1);

            expect(await MarsBaseOtcInst.investors(key, ZERO_ADDRESS)).to.be.equals(user1);
            expect(await MarsBaseOtcInst.investments(key, ZERO_ADDRESS, user1)).to.be.bignumber.that.equals(amount1);
            expect(await MarsBaseOtcInst.raised(key, ZERO_ADDRESS)).to.be.bignumber.that.equals(amount1);

            let firstDeposit = amount2.div(TWO);
            let secondDeposit = amount2;
            assert(firstDeposit.add(secondDeposit).lte(TOTAL_SUPPLY));
            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                firstDeposit.add(secondDeposit),
                {from: user2, gasPrice: ZERO}
            );
            let user2Token1AmountBefore = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            await MarsBaseOtcInst.deposit(
                key,
                TestTokenInst_2.address,
                firstDeposit,
                {from: user2, gasPrice: ZERO}
            );
            let user2Token1AmountAfter = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(firstDeposit);
            expect(user2Token1AmountBefore.sub(user2Token1AmountAfter)).to.be.bignumber.that.equals(firstDeposit);
            await MarsBaseOtcInst.deposit(
                key,
                TestTokenInst_2.address,
                secondDeposit,
                {from: user2, gasPrice: ZERO}
            );

            user2Token1AmountAfter = new BN(await TestTokenInst_2.balanceOf(user2));
            expect(await TestTokenInst_2.balanceOf(VaultInst.address)).to.be.bignumber.that.equals(ZERO);
            expect(user2Token1AmountBefore.sub(user2Token1AmountAfter)).to.be.bignumber.that.equals(amount2);

            expect(await MarsBaseOtcInst.investors(key, TestTokenInst_2.address)).to.be.equals(user2);
            expect(await MarsBaseOtcInst.investments(key, TestTokenInst_2.address, user2)).to.be.bignumber.that.equals(amount2);
            expect(await MarsBaseOtcInst.raised(key, TestTokenInst_2.address)).to.be.bignumber.that.equals(amount2);

            let ethBalanceUser2AfterOrder = new BN(await web3.eth.getBalance(user2));
            expect(ethBalanceUser2AfterOrder.sub(ethBalanceUser2BeforeOrder)).to.be.bignumber.that.equals(amount1);
            expect(await TestTokenInst_2.balanceOf(user1)).to.be.bignumber.that.equals(amount2);
        })

        it("#5 Test exceptions in deposit into ERC20/ERC20 order", async () => {
            let key = await MarsBaseOtcInst.createKey(orderOwner);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));
            assert(amount1.lte(TOTAL_SUPPLY));
            assert(amount2.lte(TOTAL_SUPPLY));

            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_1.address,
                TestTokenInst_2.address,
                amount1,
                amount2,
                {from: orderOwner}
            );

            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1.sub(ONE),
                {from: user1}
            );
            await expectRevert(
                MarsBaseOtcInst.deposit(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    {from: user1, value: ONE}
                ),
                "MarsBaseOtc: Payable not allowed here"
            );
            await expectRevert(
                MarsBaseOtcInst.deposit(
                    key,
                    TestTokenInst_1.address,
                    amount1,
                    {from: user1}
                ),
                "MarsBaseOtc: Allowance should be not less than amount"
            );
            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1.add(ONE),
                {from: user1}
            );
            let TestTokenInst_3 = await testToken.new(
                "Name 3",
                "Symbol 3",
                TOTAL_SUPPLY,
                DECIMALS,
                {from: user1}
            );
            await TestTokenInst_3.approve(
                MarsBaseOtcInst.address,
                amount1,
                {from: user1}
            );
            await expectRevert(
                MarsBaseOtcInst.deposit(
                    key,
                    TestTokenInst_3.address,
                    amount1,
                    {from: user1}
                ),
                "MarsBaseOtc: You can deposit only base or quote currency"
            );
            await MarsBaseOtcInst.deposit(
                key,
                TestTokenInst_1.address,
                amount1.div(TWO),
                {from: user1}
            );
            await TestTokenInst_1.transfer(
                user2,
                amount1.div(TWO),
                {from: user1}
            );
            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1.add(ONE),
                {from: user2}
            );
            await expectRevert(
                MarsBaseOtcInst.deposit(
                    key,
                    TestTokenInst_1.address,
                    amount1.div(TWO),
                    {from: user2}
                ),
                "MarsBaseOtc: There is already investor in this order"
            );
            await TestTokenInst_1.transfer(
                user1,
                amount1.div(TWO),
                {from: user2}
            );
            await MarsBaseOtcInst.deposit(
                key,
                TestTokenInst_1.address,
                amount1.div(TWO),
                {from: user1}
            );
            await expectRevert(
                MarsBaseOtcInst.deposit(
                    key,
                    TestTokenInst_1.address,
                    ONE,
                    {from: user1}
                ),
                "MarsBaseOtc: Limit already reached"
            );
        })

        it("#6 Test exceptions in deposit into ETH/ERC20 order", async () => {
            let key = await MarsBaseOtcInst.createKey(orderOwner);

            let amount1 = ONE_ETH.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));

            await MarsBaseOtcInst.createOrder(
                key,
                ZERO_ADDRESS,
                TestTokenInst_2.address,
                amount1,
                amount2,
                {from: orderOwner}
            );

            await expectRevert(
                MarsBaseOtcInst.deposit(
                    key,
                    ZERO_ADDRESS,
                    amount1,
                    {from: user1, value: amount1.add(ONE), gasPrice: ZERO}
                ),
                "MarsBaseOtc: Payable value should be equals value"
            );
            await expectRevert(
                MarsBaseOtcInst.deposit(
                    key,
                    ZERO_ADDRESS,
                    amount1,
                    {from: user1, value: amount1.sub(ONE), gasPrice: ZERO}
                ),
                "MarsBaseOtc: Payable value should be equals value"
            );
        })

        it("#7 Test cancel ERC20/ERC20 order", async () => {
            let key = await MarsBaseOtcInst.createKey(orderOwner);

            let amount1 = ONE_TOKEN.mul(new BN(10));
            let amount2 = ONE_TOKEN.mul(new BN(20));

            await MarsBaseOtcInst.createOrder(
                key,
                TestTokenInst_1.address,
                TestTokenInst_2.address,
                amount1,
                amount2,
                {from: orderOwner}
            );

            await TestTokenInst_1.approve(
                MarsBaseOtcInst.address,
                amount1,
                {from: user1}
            );
            await MarsBaseOtcInst.deposit(
                key,
                TestTokenInst_1.address,
                amount1.div(TWO),
                {from: user1}
            );

            await TestTokenInst_2.approve(
                MarsBaseOtcInst.address,
                amount2,
                {from: user2}
            );
            await MarsBaseOtcInst.deposit(
                key,
                TestTokenInst_2.address,
                amount2.div(TWO),
                {from: user2}
            );

            await MarsBaseOtcInst.cancel(key, {from: orderOwner});

            expect(await TestTokenInst_1.balanceOf(user1)).to.be.bignumber.that.equals(TOTAL_SUPPLY);
            expect(await TestTokenInst_2.balanceOf(user2)).to.be.bignumber.that.equals(TOTAL_SUPPLY);
        }) */

    }
)
