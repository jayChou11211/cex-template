const brokerConfig = {
  // 允许拖动修改订单
  orderLineDragging: true,
  
  // 拖动时是否弹出确认窗口
  orderLineDraggingConfirm: true,  // true: 弹出确认 | false: 即时修改
  
  // 拖动时的价格精度
  orderLineDraggingPriceStep: 0.5,

  // 启用图表点击下单
  chartClickPlaceOrder: true,
  
  // 点击下单的默认数量
  defaultOrderQuantity: 1,
  
  // 下单前是否弹出确认
  chartClickPlaceOrderConfirm: true,
};

class MyBroker {


  // 获取所有持仓（图表上显示为水平线）

  async getPositions(): Promise<Position[]> {
    // 从你的后端获取持仓列表
    return fetch('/api/positions').then(r => r.json());
  }

  // 获取所有活跃委托（图表上显示为虚线）
  async getOrders(): Promise<Order[]> {
    return fetch('/api/orders').then(r => r.json());
  }

  // 修改订单（拖动触发）
  async modifyOrder(orderId: string, newPrice: number): Promise<void> {
    // 调用后端改单 API
    await fetch('/api/orders/modify', {
      method: 'POST',
      body: JSON.stringify({ orderId, price: newPrice })
    });
    // 改单成功后，图表自动更新委托线位置
  }

  // 持仓/委托变化时，图表自动更新
  // 通过 TradingView 的 positionManager / orderManager 推送更新

  async setStopLoss(positionId: string, price: number) {
    await fetch('/api/positions/stoploss', {
      method: 'POST',
      body: JSON.stringify({ positionId, price })
    });
  }
  
  async setTakeProfit(positionId: string, price: number) {
    await fetch('/api/positions/takeprofit', {
      method: 'POST',
      body: JSON.stringify({ positionId, price })
    });
  }

  // 获取账户余额（用于交易面板展示）
  async getAccountInfo(): Promise<AccountInfo> {
    return fetch('/api/account').then(r => r.json());
  }
  
  // 下单（交易面板或图表点击触发）
  async placeOrder(order: {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'limit' | 'market';
    quantity: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<OrderResult> {
    return fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    }).then(r => r.json());
  }
}

// 在 TradingView Widget 配置中启用交易面板
new widget({
  // ...
  trading_host: 'your-broker',
  broker_factory: () => new MyBroker(),
  // 显示交易面板
  disabled_features: [],
  enabled_features: ['trading_panel'],
});

// 持仓（Position）
interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';      // 多/空
  avgPrice: number;            // 开仓均价
  quantity: number;            // 持仓数量
  unrealizedPnl: number;       // 未实现盈亏
  liquidationPrice?: number;   // 强平价格
}

// 委托（Order）
interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;               // 委托价格
  quantity: number;            // 委托数量
  filledQuantity: number;      // 已成交数量
  type: 'limit' | 'market';
  status: 'new' | 'partially_filled' | 'filled' | 'cancelled';
  stopLoss?: number;           // 止损价
  takeProfit?: number;         // 止盈价
}