# Fuse bridge

### [Multiple ERC20-TO-ERC20](https://github.com/fuseio/fuse-bridge/tree/master/multiple-erc20-to-erc20)

`ERC20-to-ERC20` multiple bridges deployed without the need of using an oracle for each pair.

This mode includes deployment of `Bridge Factory` contracts on Home and Foreign networks and a `Bridge Mapper` contract on the Home network.

The factories are used to create bridges on both networks and the mapper holds the relation between the bridges (and tokens).

### [NATIVE-TO-ERC20](https://github.com/fuseio/fuse-bridge/tree/master/native-to-erc20)

**Coins** on a Home network can be converted to ERC20-compatible **tokens** on a Foreign network.

Coins are locked on the Home side and the corresponding amount of ERC20 tokens are unlocked on the Foreign side.

When the operation is reversed, tokens are locked on the Foreign side and unlocked in the Home network.