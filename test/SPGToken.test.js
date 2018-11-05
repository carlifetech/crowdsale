const chai = require("chai");
const BN = require("bn.js");
const bnChai = require("bn-chai");
const expect = chai.expect;
chai.use(bnChai(BN));

const { ZERO_ADDRESS } = require("./helpers/constants");
const abiDecoder = require("abi-decoder");

const SPGToken = artifacts.require("SPGToken");

contract("SPGToken", accounts => {
  beforeEach(async () => {
    this.token = await SPGToken.new({ from: accounts[0] });

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
      expect(name).to.eql("SPTokenGreat");
    });

    it("token has the correct symbol", async () => {
      const symbol = await this.token.symbol();
      expect(symbol).to.eql("SPTKG");
    });

    it("token has correct decimals", async () => {
      const decimals = await this.token.decimals();
      expect(decimals).to.eq.BN(18);
    });

    it("token has a owner", async () => {
      const ownerAddress = await this.token.owner();
      expect(ownerAddress).to.eql(accounts[0]);
    });
  });

  describe("assigns the initial total supply to the creator", () => {
    it("assigns the initial total supply to the creator", async () => {
      expect(this.creatorBalance.eq(this.totalSupply)).to.be.true;
    });

    it("log has length 3", async () => {
      expect(this.logs.length).to.eql(3);
    });

    it("the transaction type is Transfer", async () => {
      expect(this.logs[1].name).to.eql("Transfer");
    });

    it("the transaction is initited from zero_address", async () => {
      expect(this.logs[0].events[0].value).to.eql(ZERO_ADDRESS);
    });

    it("tokens are transferred to deployer", async () => {
      expect(this.logs[0].events[1].value.toLowerCase()).to.eql(
        accounts[0].toLowerCase()
      );
    });

    it("all supply of tokens is transferred", async () => {
      expect(this.totalSupply).to.eq.BN(
        await this.token.balanceOf(accounts[0])
      );
    });
  });
});
