const BN = require('bn.js');

require('dotenv').config();
const {
    VAULT_OWNER,
    MARS_BASE_OTC_OWNER
} = process.env;

const MarsBaseOtc = artifacts.require("MarsBaseOtc");
const Vault = artifacts.require("Vault");

const ZERO = new BN(0);
const ONE = new BN(1);

module.exports = async function (deployer, network) {
    if (network == "test" || network == "development")
        return;

    await deployer.deploy(
        Vault
    );
    let vaultInst = await Vault.deployed();

    await deployer.deploy(
        MarsBaseOtc
    );
    let marsBaseOtcInst = await MarsBaseOtc.deployed();

    await vaultInst.setMarsBaseOtc(marsBaseOtcInst.address);
    await marsBaseOtcInst.setVault(vaultInst.address);

    await vaultInst.transferOwnership(VAULT_OWNER);
    await marsBaseOtcInst.transferOwnership(MARS_BASE_OTC_OWNER);

    console.log("Vault address =", vaultInst.address);
    console.log("MarsBaseOtc address =", marsBaseOtcInst.address);
};