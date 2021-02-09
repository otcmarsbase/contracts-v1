const BN = require('bn.js');

require('dotenv').config();
const {
} = process.env;

const MarsBaseOtc = artifacts.require("MarsBaseOtc");

const ZERO = new BN(0);

module.exports = async function (deployer, network) {
    if (network == "test" || network == "development")
        return;

    await deployer.deploy(
        MarsBaseOtc
    );
    let MarsBaseOtcInst = await MarsBaseOtc.deployed();
    console.log("MarsBaseOtc address = ", MarsBaseOtcInst.address);
};