const HDWalletProvider = require('truffle-hdwallet-provider');

require('dotenv').config();
const {
    ETHERSCAN_API_KEY,
    MNEMONIC,
    DEPLOY_GAS_LIMIT,
    DEPLOY_GAS_PRICE,
    INFURA_ID_PROJECT,
    API_KEY_BNB
} = process.env;

const Web3 = require("web3");
var web3 = new Web3(Web3.givenProvider || 'ws://some.local-or-remote.node:8545');
//const web3 = new Web3();

module.exports = {
    plugins: ['truffle-plugin-verify', "truffle-contract-size"],

    api_keys: {
        etherscan: ETHERSCAN_API_KEY,
        bscscan: API_KEY_BNB
    },

    networks: {
        development: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*",
        //    gas: 6721975
        }, 
        ropsten: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://ropsten.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 3,
            gas: DEPLOY_GAS_LIMIT,
            confirmations: 2,
            skipDryRun: true
        },
        mainnet: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://mainnet.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 1,
            //gasPrice: web3.utils.toWei(DEPLOY_GAS_PRICE, 'gwei'),
            gas: DEPLOY_GAS_LIMIT,
            skipDryRun: false
        },
        kovan: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://kovan.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 42,
            confirmations: 2,
            gas: DEPLOY_GAS_LIMIT,
            skipDryRun: true
        },
        rinkeby: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://rinkeby.infura.io/v3/" + INFURA_ID_PROJECT),
            network_id: 4,
            confirmations: 2,
            gas: DEPLOY_GAS_LIMIT,
            skipDryRun: true
        },
        bscTestnet: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://data-seed-prebsc-1-s3.binance.org:8545"),
            network_id: 97,
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        },
        bsc: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://bsc-dataseed3.binance.org"),
            network_id: 56,
            confirmations: 10,
            timeoutBlocks: 200,
            skipDryRun: true
        }

    },

    compilers: {
        solc: {
            version: "0.7.6",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        }
    }
};
