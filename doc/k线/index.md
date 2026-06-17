##

#### 数据模型

```typescript
/**
 * 单根K线数据
 */
interface Kline {
    // 核心价格数据（OHLCV）
    open: number;      // 开盘价
    high: number;      // 最高价
    low: number;       // 最低价
    close: number;     // 收盘价
    volume: number;    // 成交量（币/合约张数）
    
    // 时间标识
    openTime: number;      // K线开始时间（毫秒时间戳）
    closeTime: number;     // K线结束时间（毫秒时间戳）
    
    // 扩展字段（部分交易所提供）
    quoteVolume?: number;  // 成交额（USDT等计价货币）
    trades?: number;       // 成交笔数
    takerBuyVolume?: number; // 主动买入成交量
    takerBuyQuoteVolume?: number; // 主动买入成交额
}

/**
 * K线周期类型
 */
type KlineInterval = 
    | '1m' | '3m' | '5m' | '15m' | '30m'   // 分钟级
    | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' // 小时级
    | '1d' | '3d' | '5d' | '7d'             // 日级
    | '1w' | '1M';                          // 周级、月级
```
#### 

增加 委托线 仓位线
修改委托单
快速平仓
快速下单