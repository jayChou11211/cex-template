## cex 数据管理

#### 总则
数据分快照和 推送，也就是 历史全量数据，和变化的实时数据
snapshot + ws

#### 存放
zustandjs 用户存储数据
- marketStore：行情数据、深度、K线，订阅/取消，与 WebSocket 强绑定。
  - k线
  - orderbook / 深度
  - markprice / indexprice
  - 24HrTicker
  - miniTicker
- tradeStore：下单表单、当前委托、历史记录，本地操作队列。
- assetStore：资产余额、冻结、流水。
- userStore：认证信息、偏好设置、权限角色。  

快照数据返回后放置对应的 store，同时将 dataflag = true， 表示可以接收推送数据
推送数据传到对应的 store 做增删改、数据变化之后 update 到订阅的地方。

公共的 hook 或者 数据拦截器，将数据处理好在对应到业务层。


