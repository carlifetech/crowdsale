const { ether } = require("./helpers/ether");
const time = require("./helpers/time");
const { advanceBlock } = require("./helpers/advanceToBlock");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const BN = require("bn.js");
const bnChai = require("bn-chai");
const expect = chai.expect;
chai.use(bnChai(BN));
chai.use(chaiAsPromised);
chai.should();

const { ZERO_ADDRESS } = require("./helpers/constants");
const abiDecoder = require("abi-decoder");

const SPToken = artifacts.require("SPToken");
const SPGToken = artifacts.require("SPGToken");
const TimelockedCrowdsale = artifacts.require("TimelockedCrowdsale");

contract("TimelockedCrowdsale", accounts => {
  let deployer, wallet, investor01, investor02, investor03, team, partners;

  [
    deployer,
    wallet,
    investor01,
    investor02,
    investor03,
    team,
    partners
  ] = accounts;

  let _rate, _wallet, _cap, _openingTime, _closingTime;
  let _start, _cliffDuration, _duration, _revocable;
  let afterClosingTime, investAmount, expectedTokenAmount;
  let _saleAttributes,
    _capitalVaults,
    _saleTime,
    _beneficiaryLocksTime,
    _revocability,
    _fundsAddress,
    _fundsLocksTime;

  before(async () => {
    await advanceBlock();
  });

  beforeEach(async () => {
    // Create and deploy contracts
    spt = await SPToken.new();
    sptg = await SPGToken.new();

    // Crowdsale config
    _rate = 500;
    _wallet = wallet;
    _cap = ether("70");
    contributionMin = ether("0.002");
    contributionMax = ether("50");
    _tokenVault = deployer;
    _openingTime = (await time.latest()) + time.duration.weeks(1);
    _closingTime = _openingTime + time.duration.weeks(1);
    _start = (await time.latest()) + time.duration.minutes(1);
    _cliffDuration = time.duration.weeks(4);
    _duration = time.duration.weeks(12);
    _revocable = true;
    _teamLockStart = (await time.latest()) + time.duration.minutes(1);
    _teamLockCliff = _cliffDuration = time.duration.weeks(4);
    _teamLockDuration = _duration = time.duration.weeks(12);
    _partnersLockStart = (await time.latest()) + time.duration.minutes(1);
    _partnersLockCliff = _cliffDuration = time.duration.weeks(4);
    _partnersLockDuration = _duration = time.duration.weeks(12);

    // refactored config
    _saleAttributes = [_rate, _cap];
    _capitalVaults = [_wallet, _tokenVault];
    _saleTime = [_openingTime, _closingTime];
    _beneficiaryLocksTime = [_cliffDuration, _duration];
    _revocability = [_revocable, _revocable, _revocable];
    _fundsAddress = [team, partners];
    _fundsLocksTime = [
      _teamLockStart,
      _teamLockCliff,
      _teamLockDuration,
      _partnersLockStart,
      _partnersLockCliff,
      _partnersLockDuration
    ];

    // Crowdsale deployment
    sender = await TimelockedCrowdsale.new(
      spt.address,
      _saleAttributes,
      _capitalVaults,
      _saleTime,
      _beneficiaryLocksTime,
      _revocability,
      _fundsAddress,
      _fundsLocksTime
    );

    // Set token purchase parameters for tests
    investAmount = ether("1");
    expectedTokenAmount = (await sender.rate()) * investAmount;
    afterClosingTime = _closingTime + time.duration.seconds(1);

    // approve crowdsale contract to spend token spt
    await spt.approve(sender.address, await spt.totalSupply(), {
      from: deployer
    });
  });

  describe("TimelockedCrowdsale attributes", () => {
    it("crowdsale has the correct rate", async () => {
      const rate = await sender.rate();
      expect(rate).to.eq.BN(_rate);
    });

    it("crowdsale has the correct wallet", async () => {
      const wallet = await sender.wallet();
      expect(wallet).to.eql(_wallet);
    });

    it("crowdsale has the correct token", async () => {
      const token = await sender.token();
      expect(token).to.eql(spt.address);
    });

    it("crowdsale has the correct token vault", async () => {
      const tokenVault = await sender.tokenWallet();
      expect(tokenVault).to.eql(deployer);
    });

    it("crowdsale has the correct opening/closoing time", async () => {
      const openingTime = await sender.openingTime();
      const closingTime = await sender.closingTime();
      expect(openingTime).to.eq.BN(_openingTime);
      expect(closingTime).to.eq.BN(_closingTime);
    });

    it("crowdsale has the correct vesting cliff duration", async () => {
      const cliffDuration = await sender.beneficiaryLocksTime(0);
      expect(cliffDuration).to.eq.BN(_cliffDuration);
    });

    it("crowdsale has the correct vesting duration", async () => {
      const duration = await sender.beneficiaryLocksTime(1);
      expect(duration).to.eq.BN(_duration);
    });

    it("crowdsale has the correct revocable vesting", async () => {
      const revocable = await sender.revocability(0);
      expect(revocable).to.eql(_revocable);
    });
  });

  describe("accepting payments", () => {
    it("should reject token purchase before start time", async () => {
      await sender.buyTokens(investor01, {
        value: investAmount,
        from: investor01
      }).should.be.rejected;
    });

    it("should accept purchase during the sale", async () => {
      await time.increaseTo(_openingTime);

      const contractWallet = await sender.wallet();
      const contractWalletEthBefore = await web3.eth.getBalance(contractWallet);
      //const investorWalletSptBefore = await spt.balanceOf(investor01);
      //console.log(await web3.utils.fromWei(investorWalletSptBefore, "ether"));

      await sender.buyTokens(investor01, {
        value: investAmount,
        from: investor01
      }).should.be.fulfilled;

      const contractWalletEthAfter = await web3.eth.getBalance(contractWallet);
      const investorWalletSptAfter = await spt.balanceOf(investor01);
      const ethDelivered = contractWalletEthAfter - contractWalletEthBefore;
      //const sptDelivered = investorWalletSptAfter - investorWalletSptBefore;
      //console.log(await web3.utils.fromWei(investorWalletSptAfter, "ether"));

      // Ether paid to the contract wallet should be 1
      expect(await web3.utils.fromWei(ethDelivered.toString(), "ether")).to.eql(
        "1"
      );

      // Tokens delivered to beneficiary address should be 0
      expect(
        await web3.utils.fromWei(investorWalletSptAfter.toString(), "ether")
      ).to.eql("0");
    });

    it("should reject purchase after end of sale", async () => {
      await time.increaseTo(afterClosingTime);
      await sender.buyTokens(investor01, {
        value: investAmount,
        from: investor01
      }).should.be.rejected;
    });

    it("should reject single purchase less than minimum contribution", async () => {
      await time.increaseTo(_openingTime);
      await sender.buyTokens(investor01, {
        value: ether("0.001"),
        from: investor01
      }).should.be.rejected;
    });

    it("should reject single purchase more than max contribution", async () => {
      await time.increaseTo(_openingTime);
      await sender.buyTokens(investor01, {
        value: ether("51"),
        from: investor01
      }).should.be.rejected;
    });

    it("should reject purchase over total cap", async () => {
      await time.increaseTo(_openingTime);
      await sender.buyTokens(investor01, {
        value: ether("40"),
        from: investor01
      }).should.be.fulfilled;
      expect(await sender.capReached()).to.be.false;

      await sender.buyTokens(investor02, {
        value: ether("30"),
        from: investor02
      }).should.be.fulfilled;
      expect(await sender.capReached()).to.be.true;

      await sender.buyTokens(investor02, {
        value: ether("30"),
        from: investor02
      }).should.be.rejected;
    });

    it("should reject cumulative purchase over max contribution", async () => {
      await time.increaseTo(_openingTime);

      await sender.buyTokens(investor03, {
        value: ether("40"),
        from: investor03
      }).should.be.fulfilled;
      expect(await sender.capReached()).to.be.false;

      await sender.buyTokens(investor03, {
        value: ether("10"),
        from: investor03
      }).should.be.fulfilled;
      expect(await sender.capReached()).to.be.false;

      await sender.buyTokens(investor03, {
        value: ether("1"),
        from: investor03
      }).should.be.rejected;
    });
  });
});
