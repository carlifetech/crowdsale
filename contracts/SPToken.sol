pragma solidity ^0.4.7;

import '../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import '../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract SPToken is ERC20, Ownable {

  string public name = "SPToken";
  string public symbol = "SPTK";
  uint32 public decimals = 18;
  uint256 public totalSupply = 1000000000 * (10 ** uint256(decimals));

  constructor() public {
    _mint(msg.sender, totalSupply);

    emit Transfer(0x0, msg.sender, totalSupply);
  }
}
