var SPGToken = artifacts.require("./SPGToken.sol");

module.exports = function(deployer) {
  deployer.deploy(SPGToken);
};
