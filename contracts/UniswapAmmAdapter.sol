pragma solidity 0.6.12;

import "./interfaces/uniswap/IUniswapV2Router02.sol";
import "./interfaces/uniswap/IUniswapV2Pair.sol";
import "./interfaces/uniswap/IUniswapV2Factory.sol";
import "./interfaces/IAmmAdapter.sol";
import "./lib/SafeMath.sol";

/**
 * @title UniswapAmmAdapter
 * @author Ryuhei Matsuda
 *
 * Adapter for Uniswap V2 Router02 that encodes adding and removing liquidty
 */
contract UniswapAmmAdapter is IAmmAdapter {
    using SafeMath for uint256;

    /* ============ State Variables ============ */

    // Address of Uniswap V2 Router02 contract
    address public immutable router;
    IUniswapV2Factory public immutable factory;

    // Uniswap router function string for adding liquidity
    string internal constant ADD_LIQUIDITY =
        "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)";
    // Uniswap router function string for removing liquidity
    string internal constant REMOVE_LIQUIDITY =
        "removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)";

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _router       Address of Uniswap V2 Router02 contract
     */
    constructor(address _router) public {
        router = _router;
        factory = IUniswapV2Factory(IUniswapV2Router02(_router).factory());
    }

    /* ============ External Getter Functions ============ */

    /**
     * Return calldata for Uniswap V2 Router02
     *
     * @param  _pool                    Address of liquidity token
     * @param  _components              Address array required to add liquidity
     * @param  _maxTokensIn             AmountsIn desired to add liquidity
     * @param  _minLiquidity            Min liquidity amount to add
     */
    function getProvideLiquidityCalldata(
        address _pool,
        address[] calldata _components,
        uint256[] calldata _maxTokensIn,
        uint256 _minLiquidity
    )
        external
        view
        override
        returns (
            address _target,
            uint256 _value,
            bytes memory _calldata
        )
    {
        require(_components.length == 2, "_components length is invalid");
        require(_maxTokensIn.length == 2, "_maxTokensIn length is invalid");

        (address token0, address token1, uint256 amount0, uint256 amount1) =
            _components[0] < _components[1]
                ? (
                    _components[0],
                    _components[1],
                    _maxTokensIn[0],
                    _maxTokensIn[1]
                )
                : (
                    _components[1],
                    _components[0],
                    _maxTokensIn[1],
                    _maxTokensIn[0]
                );

        address pair = _pool;
        uint256 minLiquidity = _minLiquidity;
        (uint256 reserve0, uint256 reserve1, ) =
            IUniswapV2Pair(pair).getReserves();
        uint256 lpTotalSupply = IUniswapV2Pair(pair).totalSupply();
        uint256 amount0Min = reserve0.mul(minLiquidity).div(lpTotalSupply);
        uint256 amount1Min = reserve1.mul(minLiquidity).div(lpTotalSupply);
        _target = router;

        _calldata = abi.encodeWithSignature(
            ADD_LIQUIDITY,
            token0,
            token1,
            amount0,
            amount1,
            amount0Min,
            amount1Min,
            msg.sender,
            block.timestamp
        );
    }

    function getProvideLiquiditySingleAssetCalldata(
        address _pool,
        address _component,
        uint256 _maxTokenIn,
        uint256 _minLiquidity
    )
        external
        view
        override
        returns (
            address _target,
            uint256 _value,
            bytes memory _calldata
        )
    {
        revert("Uniswap does not support to add single asset liquidity");
    }

    /**
     * Return calldata for Uniswap V2 Router02
     *
     * @param  _pool                    Address of liquidity token
     * @param  _components              Address array required to add liquidity
     * @param  _minTokensOut            AmountsOut minimum to remove liquidity
     * @param  _liquidity               Liquidity amount to remove
     */
    function getRemoveLiquidityCalldata(
        address _pool,
        address[] calldata _components,
        uint256[] calldata _minTokensOut,
        uint256 _liquidity
    )
        external
        view
        override
        returns (
            address _target,
            uint256 _value,
            bytes memory _calldata
        )
    {
        require(_components.length == 2, "_components length is invalid");
        require(_minTokensOut.length == 2, "_minTokensOut length is invalid");

        _target = router;
        _calldata = abi.encodeWithSignature(
            REMOVE_LIQUIDITY,
            _components[0],
            _components[1],
            _liquidity,
            _minTokensOut[0],
            _minTokensOut[1],
            msg.sender,
            block.timestamp
        );
    }

    function getRemoveLiquiditySingleAssetCalldata(
        address _pool,
        address _component,
        uint256 _minTokenOut,
        uint256 _liquidity
    )
        external
        view
        override
        returns (
            address _target,
            uint256 _value,
            bytes memory _calldata
        )
    {
        revert("Uniswap does not support to remove single asset liquidity");
    }

    function getSpenderAddress(address _pool)
        external
        view
        override
        returns (address)
    {
        return router;
    }

    function isValidPool(address _pool) external view override returns (bool) {
        address token0;
        address token1;
        try IUniswapV2Pair(_pool).token0() returns (address _token0) {
            token0 = _token0;
        } catch {
            return false;
        }
        try IUniswapV2Pair(_pool).token1() returns (address _token1) {
            token1 = _token1;
        } catch {
            return false;
        }
        return factory.getPair(token0, token1) == _pool;
    }
}
