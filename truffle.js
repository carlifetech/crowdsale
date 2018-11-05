/*
 * NB: since truffle-hdwallet-provider 0.0.5 you must wrap HDWallet providers in a
 * function when declaring them. Failure to do so will cause commands to hang. ex:
 * ```
 * mainnet: {
 *     provider: function() {
 *       return new HDWalletProvider(mnemonic, 'https://mainnet.infura.io/<infura-key>')
 *     },
 *     network_id: '1',
 *     gas: 4500000,
 *     gasPrice: 10000000000,
 *   },
 */
const HDWalletProvider = require("truffle-hdwallet-provider");

require("dotenv").config();

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },

    ganache: {
      /*
      provider: () => {
        return new HDWalletProvider(
          "blossom nothing forum coil consider chat shoe rhythm birth tuna auto limb",
          "http://127.0.0.1:8545/"
        );
      },*/
      host: "localhost",
      port: 8545,
      network_id: "*"
    },

    // Below are testnets
    ropsten: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNENOMIC,
          "https://ropsten.infura.io/v3/" + process.env.INFURA_API_KEY
        );
      },
      network_id: 3
      //gas: 3000000,
      //gasPrice: 21
    },

    kovan: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNENOMIC,
          "https://kovan.infura.io/v3/" + process.env.INFURA_API_KEY
        );
      },
      network_id: 42
      //gas: 3000000,
      //gasPrice: 21
    },

    rinkeby: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNENOMIC,
          "https://rinkeby.infura.io/v3/" + process.env.INFURA_API_KEY
        );
      },
      network_id: 4
      //gas: 3000000
      //gasPrice: 21
    },

    main: {
      provider: () => {
        return new HDWalletProvider(
          process.env.MNENOMIC,
          "https://mainnet.infura.io/v3/" + process.env.INFURA_API_KEY
        );
      },
      network_id: 1
      //gas: 3000000,
      //gasPrice: 21
    }
  }
};
