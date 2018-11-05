pragma solidity ^0.4.7;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/SafeERC20.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/lifecycle/Pausable.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/crowdsale/emission/AllowanceCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/CappedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/distribution/FinalizableCrowdsale.sol';
import 'openzeppelin-solidity/contracts/drafts/TokenVesting.sol';

contract TimelockedCrowdsale is Ownable, Pausable, AllowanceCrowdsale, CappedCrowdsale, TimedCrowdsale, FinalizableCrowdsale {
  using SafeERC20 for ERC20;
  using SafeMath for uint256;

  // Onwer of this contract & Wallet to store the ETH
  address public owner;

  // the rate of exchange
  uint256 public rateExchange;

  // set upper/lower bound of cap and track investor contributions
  uint256 public contributionMin = 2000000000000000; // 0.002 Ether
  uint256 public contributionMax = 50000000000000000000; // 50 Ether
  mapping(address => uint256) public contributions;

  // distribution of tokens
  // fundsAddress --> [teamFund, partnersFund]
  // fundsLocksTime --> [teamLockCliff, teamLockDuration, partnersLockCliff, partnersLockDuration]
  address[] public fundsAddress;
  address[] public fundsLocksAddress;
  uint256[] public fundsLocksTime;
  uint256 public tokenTeamAmount = 100000000;
  uint256 public tokenPartnersAmount = 100000000;
  mapping(address => uint256) public fundsLocksStartTimes;

  // Token time lock
  // beneficiaryLocksTime --> [cliff, duration]
  address[] public beneficiaryLocks;
  uint256[] public beneficiaryLocksTime;
  bool[] public revocability;
  mapping(address => uint256) public beneficiaryLocksStartTimes;

  // events to be emitted
  event CreatedLock(TokenVesting newTokenLock);

  // _saleTime --> [_openingTime, _closingTime]
  // _saleAttributes --> [_rate, _cap]
  // _capitalVaults --> [_wallet, _tokenVault]
  constructor(
    ERC20 _token,
    uint256[] _saleAttributes,
    address[] _capitalVaults,
    uint256[] _saleTime,
    uint256[] _beneficiaryLocksTime,
    bool[] _revocability,
    address[] _fundsAddress,
    uint256[] _fundsLocksTime
  ) Crowdsale(_saleAttributes[0], _capitalVaults[0], _token)
    AllowanceCrowdsale(_capitalVaults[1])
    CappedCrowdsale(_saleAttributes[1])
    TimedCrowdsale(_saleTime[0], _saleTime[1])
    public {
    owner = msg.sender;
    beneficiaryLocksTime = _beneficiaryLocksTime;
    revocability = _revocability;
    fundsAddress = _fundsAddress;
    fundsLocksTime = _fundsLocksTime;
  }

  function getUserContribution(address _beneficiary) public view returns(uint256) {
    return contributions[_beneficiary];
  }

  function getUserLockStartTime(address _beneficiary) public view returns(uint256) {
    return beneficiaryLocksStartTimes[_beneficiary];
  }

  function getTeamPartnerLockStartTime(address _teamPartner) public view returns(uint256) {
    return fundsLocksStartTimes[_teamPartner];
  }

  // withdraw funds from this contract
  function withdraw(address toBeneficiary) public payable onlyOwner whenNotPaused {
      toBeneficiary.transfer(this.wallet().balance);
    }

  // token lock factory
  function createTokenLock(
    address _beneficiary,
    uint256 _start,
    uint256 _cliffDuration,
    uint256 _duration,
    bool _revocable
  ) public returns(TokenVesting) {
    TokenVesting newTokenLock = new TokenVesting(
      _beneficiary,
      _start,
      _cliffDuration,
      _duration,
      _revocable
    );
    beneficiaryLocks.push(newTokenLock);
    newTokenLock.transferOwnership(owner);
    emit CreatedLock(newTokenLock);
    return newTokenLock;
  }

  // returns a list of all created token locks for beneficiarys
  function getTokenLocksBeneficiarys() public view returns (address[]) {
    return beneficiaryLocks;
  }

  // returns a list of all created token locks for team & partners
  function getTokenLocksTeamAndPartners() public view returns (address[]) {
    return fundsLocksAddress;
  }

  // validate purchse cap
  function _preValidatePurchase(
    address _beneficiary,
    uint256 _weiAmount
  ) internal view {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    uint256 _existingContribution = contributions[_beneficiary];
    uint256 _newContribution = _existingContribution.add(_weiAmount);
    require(_newContribution >= contributionMin && _newContribution <= contributionMax);
    contributions[_beneficiary] = _newContribution;
  }

  // override the _processPurchase function to deliver tokens to the vests
  function _processPurchase(
    address beneficiary,
    uint256 tokenAmount
  )
    internal
  {
    uint256 beneficiaryLocksStart = now;
    beneficiaryLocksStartTimes[beneficiary] = beneficiaryLocksStart;
    TokenVesting newTokenLock = createTokenLock(
      beneficiary,
      beneficiaryLocksStart, // current block timestamp
      beneficiaryLocksTime[0], // cliffDuration
      beneficiaryLocksTime[1], // duration
      revocability[0]
    );
    super._deliverTokens(newTokenLock, tokenAmount);
  }

  // override to add finalization logic
  function _finalization() internal {
    uint256 fundsLocksStart = now;
    TokenVesting teamFundLock = new TokenVesting(
      fundsAddress[0],
      fundsLocksStart,
      fundsLocksTime[0],
      fundsLocksTime[1],
      revocability[1]
    );
    super._deliverTokens(teamFundLock, tokenTeamAmount);
    fundsLocksAddress.push(teamFundLock);
    fundsLocksStartTimes[teamFundLock] = fundsLocksStart;

    TokenVesting partnersFundLock = new TokenVesting(
      fundsAddress[1],
      fundsLocksStart,
      fundsLocksTime[2],
      fundsLocksTime[3],
      revocability[2]
    );
    super._deliverTokens(partnersFundLock, tokenPartnersAmount);
    fundsLocksAddress.push(partnersFundLock);
    fundsLocksStartTimes[partnersFundLock] = fundsLocksStart;

    super._finalization();
  }
}
