const chai = require("chai");
const BN = require("bn.js");
const bnChai = require("bn-chai");
const expect = chai.expect;
chai.use(bnChai(BN));

const { ZERO_ADDRESS } = require("./helpers/constants");
const abiDecoder = require("abi-decoder");

const SimpleCrowdsale = artifacts.require("SimpleCrowdsale");
const SPToken = artifacts.require("SPToken");
const SPGToken = artifacts.require("SPGToken");

let sender, spt, sptg;

contract("Exchange Transfer", async accounts => {
  let deployer, investor01, investor02, accountD;

  [deployer, investor01, investor02, accountD] = accounts;

  beforeEach(async () => {
    // Create and deploy contracts
    sender = await SimpleCrowdsale.new();
    spt = await SPToken.new();
    sptg = await SPGToken.new();

    // add tokens to the exchange
    await sender.addNewToken(web3.utils.fromAscii("SPTK"), spt.address);
    await sender.addNewToken(web3.utils.fromAscii("SPTKG"), sptg.address);
  });

  describe("contract management", () => {
    it("should transfer sender token to another wallet", async () => {
      // specify amount to transfer
      let amount = new BN(50000e5);

      // approve exchange to spend token spt
      await spt.approve(sender.address, amount, { from: deployer });

      // transfer 'amount' of SPTK (spt) to accountB
      await sender.transferTokens(
        web3.utils.fromAscii("SPTK"),
        investor01,
        amount,
        { from: deployer }
      );

      // check the balance of SPT on accountB
      let balance = (await spt.balanceOf(investor01)).toString();

      expect(balance).to.eql(amount.toString());

      console.log("address - deployer: %o", deployer);

      const ownerSpt = await spt.owner();
      const ownerSptg = await sptg.owner();
      const ownerSender = await sender.owner();

      console.log("address - owner of spt: %o", ownerSpt);
      console.log("address - owner of sptg: %o", ownerSptg);
      console.log("address - owner of SimpleCrowdsale: %o", ownerSender);
    });
  });
});
