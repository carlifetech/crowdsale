const { ether } = require("./helpers/ether");
const time = require("./helpers/time");
const { advanceBlock } = require("./helpers/advanceToBlock");
const { ethGetBlock } = require("./helpers/web3");

// web3.utils library uses bn.js while web3.js uses bignumber.js
// bn.js has serious precision issues during math operations, while
// bignumber.js hasn't.
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const BN = require("bn.js");
const BigNumber = require("bignumber.js");
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

const TokenVesting = artifacts.require("TokenVesting");

contract("TimelockedCrowdsale", accounts => {
  let deployer,
    wallet,
    investor01,
    investor02,
    investor03,
    team,
    partners,
    anyone;

  [
    deployer,
    wallet,
    investor01,
    investor02,
    investor03,
    team,
    partners,
    anyone
  ] = accounts;

  let _rate, _wallet, _cap, _openingTime, _closingTime;
  let _start, _cliffDuration, _duration, _revocable;
  let afterClosingTime, investAmount, investAmountEth, expectedTokenAmount;
  let _saleAttributes,
    _capitalVaults,
    _saleTime,
    _beneficiaryLocksTime,
    _revocability,
    _fundsAddress,
    _fundsLocksTime;

  let beneficiaryAddress, beneficiaryLockStartTime;

  before(async () => {
    await advanceBlock();
  });

  beforeEach(async () => {
    // Create and deploy contracts
    spt = await SPToken.new();
    sptg = await SPGToken.new();

    // Crowdsale config
    _rate = 4000;
    _wallet = wallet;
    _cap = ether("62500");
    contributionMin = ether("0.002");
    contributionMax = ether("50");
    _tokenVault = deployer;
    _openingTime = (await time.latest()) + time.duration.weeks(1);
    _closingTime = _openingTime + time.duration.weeks(1);
    //_start = (await time.latest()) + time.duration.minutes(1);
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
      _teamLockCliff,
      _teamLockDuration,
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
    investAmountEth = await web3.utils.fromWei(investAmount, "ether");
    expectedTokenAmount = (await sender.rate()) * investAmountEth;
    afterClosingTime = _closingTime + time.duration.seconds(1);

    // approve crowdsale contract to spend token spt
    await spt.approve(sender.address, await spt.totalSupply(), {
      from: deployer
    });

    await time.increaseTo(_openingTime);

    await sender.buyTokens(investor01, {
      value: investAmount,
      from: investor01
    });

    [beneficiaryLocks] = await sender.getTokenLocksBeneficiarys();
    beneficiaryLock = await TokenVesting.at(beneficiaryLocks);
    beneficiaryAddress = await beneficiaryLock.beneficiary();
    beneficiaryLockStartTime = await sender.getUserLockStartTime(
      beneficiaryAddress
    );
  });

  describe("accepting payments", () => {
    it("can get state", async () => {
      const _cliffDurationBN = new BN(_cliffDuration);
      expect(beneficiaryAddress).to.eql(investor01);
      expect(await beneficiaryLock.cliff()).to.eq.BN(
        beneficiaryLockStartTime.add(new BN(_cliffDuration))
      );
      expect(await beneficiaryLock.start()).to.eq.BN(beneficiaryLockStartTime);
      expect(await beneficiaryLock.duration()).to.eq.BN(_duration);
      expect(await beneficiaryLock.revocable()).to.be.true;
    });

    it("locked correct amount before release", async () => {
      const amountInLock = await spt.balanceOf(beneficiaryLock.address);
      const deliveredToLock = investAmountEth * _rate;
      expect(await web3.utils.fromWei(amountInLock), "ether").to.eq.BN(
        deliveredToLock
      );
    });

    it("cannot be released before cliff", async () => {
      await beneficiaryLock.release(spt.address).should.be.rejected;
    });

    it("can be released after cliff", async () => {
      await time.increaseTo(
        beneficiaryLockStartTime.toNumber() +
          _cliffDuration +
          time.duration.weeks(1)
      );
      const { logs } = await beneficiaryLock.release(spt.address);
      expect(logs[0].args.amount).to.eq.BN(await spt.balanceOf(investor01));
    });

    it("should release proper amount after cliff", async () => {
      await time.increaseTo(
        beneficiaryLockStartTime.toNumber() + _cliffDuration
      );

      /*const investorBalanceBefore = await spt.balanceOf(investor01);
      console.log(
        "Amount of spt on investor's account before release: %o",
        await web3.utils.fromWei(investorBalanceBefore, "ether")
      );*/

      const amountInLockBefore = await spt.balanceOf(beneficiaryLock.address);
      /*console.log(
        "Amount of spt locked before release:                %o",
        await web3.utils.fromWei(amountInLockBefore, "ether")
      );*/

      const { receipt } = await beneficiaryLock.release(spt.address);
      const block = await ethGetBlock(receipt.blockNumber);
      const releaseTime = block.timestamp;

      /*const amountInLock = await spt.balanceOf(beneficiaryLock.address);
      console.log(
        "Amount of spt locked:                               %o",
        await web3.utils.fromWei(amountInLock, "ether")
      );*/

      const releasedAmount = amountInLockBefore
        .mul(new BN(releaseTime - beneficiaryLockStartTime.toNumber()))
        .div(new BN(_duration));

      /*console.log(
        "Amount of spt supposed to be released:              %o",
        await web3.utils.fromWei(releasedAmount, "ether")
      );
      const investorBalanceAfter = await spt.balanceOf(investor01);
      console.log(
        "Amount of spt on investor's account after release:  %o",
        await web3.utils.fromWei(investorBalanceAfter, "ether")
      );*/
      expect(await spt.balanceOf(investor01)).to.eq.BN(releasedAmount);
      expect(await beneficiaryLock.released(spt.address)).to.eq.BN(
        releasedAmount
      );
    });

    it("should linearly release tokens during vesting period", async () => {
      const vestingPeriod = _duration - _cliffDuration;
      const checkpoints = 4;
      const amountInLockBefore = new BN(
        await spt.balanceOf(beneficiaryLock.address)
      );

      for (let i = 1; i <= checkpoints; i++) {
        const now =
          beneficiaryLockStartTime.toNumber() +
          _cliffDuration +
          i * (vestingPeriod / checkpoints);
        await time.increaseTo(now);

        await beneficiaryLock.release(spt.address);
        const expectedVesting = amountInLockBefore
          .mul(new BN(now - beneficiaryLockStartTime.toNumber()))
          .div(new BN(_duration));

        expect(await spt.balanceOf(investor01)).to.eq.BN(expectedVesting);
        expect(await beneficiaryLock.released(spt.address)).to.eq.BN(
          expectedVesting
        );
      }
    });

    it("should have released all after end", async () => {
      await time.increaseTo(beneficiaryLockStartTime.toNumber() + _duration);
      await beneficiaryLock.release(spt.address);

      const sptBalanceInvestor01 = await spt.balanceOf(investor01);
      const sptReleasedByLock = await beneficiaryLock.released(spt.address);
      expect(await web3.utils.fromWei(sptBalanceInvestor01, "ether")).to.eq.BN(
        expectedTokenAmount.toString()
      );
      expect(await web3.utils.fromWei(sptReleasedByLock, "ether")).to.eq.BN(
        expectedTokenAmount.toString()
      );
    });

    it("lock ownership is transfered to deployer of crowdsale contract", async () => {
      expect(await beneficiaryLock.owner()).to.be.eql(deployer);
    });

    it("should be revoked by owner if revocable is set", async () => {
      const { logs } = await beneficiaryLock.revoke(spt.address, {
        from: deployer
      });
      expect(logs[0].event).to.be.eql("TokenVestingRevoked");
      expect(await beneficiaryLock.revoked(spt.address)).to.be.true;
    });

    it("should fail to be revoked a second time", async () => {
      await beneficiaryLock.revoke(spt.address, { from: deployer });
      await beneficiaryLock.revoke(spt.address, { from: deployer }).should.be
        .rejected;
    });
  });

  describe("token distribution", () => {
    it("cannot be finalized before ending", async () => {
      await sender.finalize({ from: anyone }).should.be.rejected;
    });

    it("can be finalized after ending by anyone", async () => {
      await time.increaseTo(afterClosingTime);
      await sender.finalize({ from: anyone }).should.be.fulfilled;
    });

    it("cannot be finalized twice", async () => {
      await time.increaseTo(afterClosingTime);
      await sender.finalize({ from: anyone }).should.be.fulfilled;
      await sender.finalize({ from: anyone }).should.be.rejected;
    });
  });

  context("once finalized", () => {
    before(async () => {
      await advanceBlock();
    });

    beforeEach(async () => {
      // Create and deploy contracts
      spt = await SPToken.new();
      sptg = await SPGToken.new();

      // Crowdsale config
      _rate = 4000;
      _wallet = wallet;
      _cap = ether("62500");
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
        _teamLockCliff,
        _teamLockDuration,
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
      investAmountEth = await web3.utils.fromWei(investAmount, "ether");
      expectedTokenAmount = (await sender.rate()) * investAmountEth;
      afterClosingTime = _closingTime + time.duration.seconds(1);

      // approve crowdsale contract to spend token spt
      await spt.approve(sender.address, await spt.totalSupply(), {
        from: deployer
      });

      await time.increaseTo(_openingTime);

      await sender.buyTokens(investor01, {
        value: investAmount,
        from: investor01
      });

      [beneficiaryLocks] = await sender.getTokenLocksBeneficiarys();
      beneficiaryLock = await TokenVesting.at(beneficiaryLocks);

      await time.increaseTo(afterClosingTime);
      await sender.finalize({ from: anyone });

      teamPartnerLocks = await sender.getTokenLocksTeamAndPartners();
      teamLock = await TokenVesting.at(teamPartnerLocks[0]);
      partnerLock = await TokenVesting.at(teamPartnerLocks[1]);
      teamLockStartTime = await sender.getTeamPartnerLockStartTime(team);
      partnerLockStartTime = await sender.getTeamPartnerLockStartTime(partners);
    });

    describe("token distribution locks", () => {
      it("delivers designated tokens to team's fund lock", async () => {
        const teamFundAddress = (await sender.getTokenLocksTeamAndPartners())[0];
        const AmountInTeamLock = await spt.balanceOf(teamFundAddress);
        expect(AmountInTeamLock).to.be.eql(await sender.tokenTeamAmount());
      });

      it("delivers designated tokens to partner's fund lock", async () => {
        const partnerFundAddress = (await sender.getTokenLocksTeamAndPartners())[1];
        const AmountInPartnerLock = await spt.balanceOf(partnerFundAddress);
        expect(AmountInPartnerLock).to.eq.BN(
          await sender.tokenPartnersAmount()
        );
      });

      it("crowdsale contract is the owner of the fund locks", async () => {
        expect(await teamLock.owner()).to.be.eql(sender.address);
        expect(await partnerLock.owner()).to.be.eql(sender.address);
      });

      it("delivers designated tokens to team's address after release from token", async () => {
        await time.increaseTo(
          teamLockStartTime.toNumber() + _fundsLocksTime[1]
        );
        await teamLock.release(spt.address);

        const sptBalanceTeam = await spt.balanceOf(team);
        const sptReleasedByLock = await teamLock.released(spt.address);
        const teamTokenAmount = await sender.tokenTeamAmount();

        expect(sptBalanceTeam.toNumber()).to.be.eql(teamTokenAmount.toNumber());
        expect(sptReleasedByLock.toNumber()).to.be.eql(
          teamTokenAmount.toNumber()
        );
      });

      it("delivers designated tokens to partner's address after release from token", async () => {
        await time.increaseTo(
          partnerLockStartTime.toNumber() + _fundsLocksTime[3]
        );
        await partnerLock.release(spt.address);

        const sptBalancePartner = await spt.balanceOf(partners);
        const sptReleasedByLock = await partnerLock.released(spt.address);
        const partnerTokenAmount = await sender.tokenPartnersAmount();

        expect(sptBalancePartner.toNumber()).to.be.eql(
          partnerTokenAmount.toNumber()
        );
        expect(sptReleasedByLock.toNumber()).to.be.eql(
          partnerTokenAmount.toNumber()
        );
      });
    });
  });
});
