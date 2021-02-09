const BN = require('bn.js');

require('dotenv').config();
const {
    VAULT_OWNER,
    MARS_BASE_OTC_OWNER
} = process.env;

const Vault = artifacts.require("Vault");
const MarsBaseOtc = artifacts.require("MarsBaseOtc");

const ZERO = new BN(0);

module.exports = async function (deployer, network) {
    if (network == "test" || network == "development")
        return;

    let VaultInst = await Vault.deployed();
    let MarsBaseOtcInst = await MarsBaseOtc.deployed();

    await VaultInst.setMarsBaseOtc(MarsBaseOtcInst.address);
    await MarsBaseOtcInst.setVault(VaultInst.address);

    await VaultInst.transferOwnership(VAULT_OWNER);
    await MarsBaseOtcInst.transferOwnership(MARS_BASE_OTC_OWNER);

    console.log("Contracts connected");
};