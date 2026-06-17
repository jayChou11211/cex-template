// src/components/Tradingview/datafeed.ts
const datafeed = {
  // 1. 初始化配置，声明支持的周期、交易所等
  onReady: (callback) => { /* ... */ },
  
  // 2. 解析交易对信息（精度、最小变动等）
  resolveSymbol: (symbolName, onResolve) => { /* ... */ },
  
  // 3. 获取历史K线数据（核心）
  getBars: (symbolInfo, resolution, from, to, onResult) => { /* ... */ },
  
  // 4. 订阅实时K线推送
  subscribeBars: (symbolInfo, resolution, onRealtime) => { /* ... */ },
  
  // 5. 取消订阅
  unsubscribeBars: (subscriberUID) => { /* ... */ }
};

// 快照
// GET /market/klines?symbol=BTC/USDT&interval=5&start=1710000000&end=1710005000
// 返回格式（TradingView 标准）
{
  "s": "ok",                    // 状态：ok / error / no_data
  "t": [1710000000, 1710000300], // 时间戳数组（秒）
  "o": [65000, 65100],          // 开盘价
  "h": [65200, 65300],          // 最高价
  "l": [64900, 65050],          // 最低价
  "c": [65100, 65200],          // 收盘价
  "v": [10, 12]                 // 成交量
}

// 推送
subscribeBars: (symbolInfo, resolution, onRealtime) => {
  const ws = new WebSocket("wss://yourdomain/ws");
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'kline') {
      // 将实时数据转换为 TradingView Bar 格式
      onRealtime({
        time: msg.data.time * 1000,  // 转为毫秒
        open: msg.data.open,
        high: msg.data.high,
        low: msg.data.low,
        close: msg.data.close,
        volume: msg.data.volume
      });
    }
  };
}