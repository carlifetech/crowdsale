/*
const ganache = require("ganache-cli");
web3.setProvider(ganache.provider());
*/
/*
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider());
*/

const chai = require("chai");
const BN = require("bn.js");
const bnChai = require("bn-chai");
const expect = chai.expect;
chai.use(bnChai(BN));

const { ZERO_ADDRESS } = require("./helpers/constants");
const abiDecoder = require("abi-decoder");

const SimpleToken = artifacts.require("SimpleToken");

contract("SimpleToken", accounts => {
  const token_name = "MyTestToken";
  const token_symbol = "MTT";
  const token_decimals = 18;

  beforeEach(async () => {
    this.token = await SimpleToken.new(
      token_name,
      token_symbol,
      token_decimals
    );

    this.totalSupply = await this.token.totalSupply();
    this.creatorBalance = await this.token.balanceOf(accounts[0]);
    const receipt = await web3.eth.getTransactionReceipt(
      this.token.transactionHash
    );
    abiDecoder.addABI(this.token.abi);
    this.logs = abiDecoder.decodeLogs(receipt.logs);
  });

  describe("token attributes", () => {
    // check if the contracts are deployed successfully
    it("deploys token contract", async () => {
      const address = await this.token.address;
      assert.ok(address);
    });

    it("token has the correct name", async () => {
      const name = await this.token.name();
      assert.equal(name, token_name);
    });

    it("token has the correct symbol", async () => {
      const symbol = await this.token.symbol();
      assert.equal(symbol, token_symbol);
    });

    it("token has correct decimals", async () => {
      const decimals = await this.token.decimals();
      expect(decimals).to.eq.BN(18);
    });
  });

  describe("assigns the initial total supply to the creator", () => {
    it("assigns the initial total supply to the creator", async () => {
      expect(this.creatorBalance.eq(this.totalSupply)).to.be.true;
    });

    it("log has length 1", async () => {
      expect(this.logs.length).to.eql(1);
    });

    it("the transaction type is Transfer", async () => {
      expect(this.logs[0].name).to.eql("Transfer");
    });

    it("the transaction is initited from zero_address", async () => {
      expect(this.logs[0].events[0].value).to.eql(ZERO_ADDRESS);
    });

    it("tokens are transferred to accounts[0]", async () => {
      expect(this.logs[0].events[1].value.toLowerCase()).to.eql(
        accounts[0].toLowerCase()
      );
    });

    it("all supply of tokens is transferred", async () => {
      expect(this.totalSupply).to.eq.BN(this.logs[0].events[2].value);
    });
  });
});
