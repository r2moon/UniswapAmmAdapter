const { expectRevert, constants, time } = require('@openzeppelin/test-helpers');
const { ethers } = require('ethers');
const BN = require('bn.js');
const truffleContract = require('@truffle/contract');

const MockERC20 = artifacts.require('MockERC20');
const UniswapAmmAdapter = artifacts.require('UniswapAmmAdapter');
const Controller = artifacts.require('Controller');
const IntegrationRegistry = artifacts.require('IntegrationRegistry');
const SetToken = artifacts.require('SetToken');
const AmmModule = artifacts.require('AmmModule');
const BasicIssuanceModule = artifacts.require('BasicIssuanceModule');

const UniswapRouter02Abi = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');
const UniswapFactoryAbi = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const console = require('console');

const UniswapRouter02 = truffleContract(UniswapRouter02Abi);
const UniswapV2Factory = truffleContract(UniswapFactoryAbi);
UniswapRouter02.setProvider(web3.currentProvider);
UniswapV2Factory.setProvider(web3.currentProvider);

const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

contract('UniswapAmmAdapter', ([deployer, alice, bob, carol]) => {
  let token0;
  let token1;
  let factory;
  let router;
  let pair;
  let token0InPool = new BN('100000000000000000000000');
  let token1InPool = new BN('50000000000000000000000');
  let controller;
  let setToken;
  let ammModule;
  let integrationRegistry;
  let uniswapAmmAdapter;
  let issuranceModule;

  beforeEach(async () => {
    const tokenA = await MockERC20.new(
      'Test1',
      'TEST1',
      18,
      new BN('1000000000000000000000000'),
      { from: deployer },
    );
    const tokenB = await MockERC20.new(
      'Test2',
      'TEST2',
      18,
      new BN('1000000000000000000000000'),
      { from: deployer },
    );
    if (tokenA.address < tokenB.address) {
      token0 = tokenA;
      token1 = tokenB;
    } else {
      token0 = tokenB;
      token1 = tokenA;
    }
    factory = await UniswapV2Factory.new(deployer, { from: deployer });
    router = await UniswapRouter02.new(factory.address, wethAddress, {
      from: deployer,
    });
    uniswapAmmAdapter = await UniswapAmmAdapter.new(router.address, {
      from: deployer,
    });
    controller = await Controller.new(deployer, { from: deployer });
    integrationRegistry = await IntegrationRegistry.new(controller.address, {
      from: deployer,
    });
    ammModule = await AmmModule.new(controller.address);
    issuranceModule = await BasicIssuanceModule.new(controller.address, {
      from: deployer,
    });
    setToken = await SetToken.new(
      [token0.address, token1.address],
      ['10000000000000000000', '5000000000000000000'],
      [ammModule.address, issuranceModule.address],
      controller.address,
      deployer,
      'SetToken',
      'SetToken',
    );
    await controller.initialize(
      [deployer],
      [ammModule.address, issuranceModule.address],
      [integrationRegistry.address],
      [0],
      {
        from: deployer,
      },
    );
    await integrationRegistry.addIntegration(
      ammModule.address,
      'UniswapAmm',
      uniswapAmmAdapter.address,
      { from: deployer },
    );
    await controller.addSet(setToken.address, { from: deployer });
    await issuranceModule.initialize(setToken.address, constants.ZERO_ADDRESS, {
      from: deployer,
    });
    await ammModule.initialize(setToken.address);
    await token0.approve(issuranceModule.address, token0InPool, {
      from: deployer,
    });
    await token1.approve(issuranceModule.address, token1InPool, {
      from: deployer,
    });
    await issuranceModule.issue(
      setToken.address,
      '1000000000000000000',
      deployer,
    );
    await token0.approve(router.address, token0InPool, { from: deployer });
    await token1.approve(router.address, token1InPool, { from: deployer });
    await router.addLiquidity(
      token0.address,
      token1.address,
      token0InPool,
      token1InPool,
      0,
      0,
      deployer,
      '7777777777',
      { from: deployer },
    );
    pair = await factory.getPair(token0.address, token1.address);
  });

  // describe('AmmModule Add liquidity', () => {
  //   it('Check add liquidity callback', async () => {
  //     const pairToken = await MockERC20.at(pair);
  //     const res = await uniswapAmmAdapter.getProvideLiquidityCalldata(
  //       pair,
  //       [token0.address, token1.address],
  //       ['10000000000000000000', '5000000000000000000'],
  //       '1000000',
  //     );
  //     assert.equal(res._target, router.address);
  //     assert.equal(res._value, '0');
  //     const lpSupply = new BN(await pairToken.totalSupply());
  //     const minLiquidity = new BN('1000000');
  //     const amount0Min = token0InPool.mul(minLiquidity).div(lpSupply);
  //     const amount1Min = token1InPool.mul(minLiquidity).div(lpSupply);
  //     const encodedFunction = web3.eth.abi.encodeFunctionSignature(
  //       'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
  //     );
  //     const currentTime = (await time.latest()).toString();
  //     const encodedParamaters = web3.eth.abi.encodeParameters(
  //       [
  //         'address',
  //         'address',
  //         'uint256',
  //         'uint256',
  //         'uint256',
  //         'uint256',
  //         'address',
  //         'uint256',
  //       ],
  //       [
  //         token0.address,
  //         token1.address,
  //         '10000000000000000000',
  //         '5000000000000000000',
  //         amount0Min.toString(),
  //         amount1Min.toString(),
  //         deployer,
  //         currentTime,
  //       ],
  //     );
  //     assert.equal(
  //       res._calldata,
  //       encodedFunction + encodedParamaters.substr(2),
  //     );
  //   });

  //   it('Add liquidity', async () => {
  //     const pairToken = await MockERC20.at(pair);
  //     await ammModule.addLiquidity(
  //       setToken.address,
  //       'UniswapAmm',
  //       pair,
  //       '1000000000000000000',
  //       [token0.address, token1.address],
  //       ['10000000000000000000', '5000000000000000000'],
  //       { from: deployer },
  //     );
  //     assert.equal(await token0.balanceOf(setToken.address), '0');
  //     assert.equal(await token1.balanceOf(setToken.address), '0');
  //     assert.equal(
  //       (await pairToken.balanceOf(setToken.address)).toString(),
  //       '7071067811865475244',
  //     );
  //   });

  //   it('Revert single asset providing liquidity', async () => {
  //     await expectRevert(
  //       uniswapAmmAdapter.getProvideLiquiditySingleAssetCalldata(
  //         pair,
  //         token0.address,
  //         '10000000000000000000',
  //         '1000000',
  //       ),
  //       'Uniswap does not support to add single asset liquidity',
  //     );
  //   });
  // });

  describe('AmmModule Remove liquidity', () => {
    it('Check remove liquidity callback', async () => {
      const pairToken = await MockERC20.at(pair);
      const res = await uniswapAmmAdapter.getRemoveLiquidityCalldata(
        pair,
        [token0.address, token1.address],
        ['10000000000000000000', '5000000000000000000'],
        '1000000',
      );
      assert.equal(res._target, router.address);
      assert.equal(res._value, '0');
      const encodedFunction = web3.eth.abi.encodeFunctionSignature(
        'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)',
      );
      const currentTime = (await time.latest()).toString();
      const encodedParamaters = web3.eth.abi.encodeParameters(
        [
          'address',
          'address',
          'uint256',
          'uint256',
          'uint256',
          'address',
          'uint256',
        ],
        [
          token0.address,
          token1.address,
          '1000000',
          '10000000000000000000',
          '5000000000000000000',
          deployer,
          currentTime,
        ],
      );
      assert.equal(
        res._calldata,
        encodedFunction + encodedParamaters.substr(2),
      );
    });

    it('Remove liquidity', async () => {
      const pairToken = await MockERC20.at(pair);
      await ammModule.addLiquidity(
        setToken.address,
        'UniswapAmm',
        pair,
        '1000000000000000000',
        [token0.address, token1.address],
        ['10000000000000000000', '5000000000000000000'],
        { from: deployer },
      );
      await ammModule.removeLiquidity(
        setToken.address,
        'UniswapAmm',
        pair,
        '1000000000000000000',
        [token0.address, token1.address],
        ['1000000000000000000', '500000000000000000'],
        { from: deployer },
      );
      // console.log((await pairToken.balanceOf(setToken.address)).toString());
      assert.equal(
        (await pairToken.balanceOf(setToken.address)).toString(),
        '6071067811865475244',
      );
      assert.equal(
        await token0.balanceOf(setToken.address),
        '1414213562373095048',
      );
      assert.equal(
        await token1.balanceOf(setToken.address),
        '707106781186547524',
      );
    });

    it('Revert single asset removing liquidity', async () => {
      await expectRevert(
        uniswapAmmAdapter.getRemoveLiquiditySingleAssetCalldata(
          pair,
          token0.address,
          '10000000000000000000',
          '1000000',
        ),
        'Uniswap does not support to remove single asset liquidity',
      );
    });
  });
});
