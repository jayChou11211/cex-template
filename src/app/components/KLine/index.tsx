// src/components/Tradingview/index.tsx
import { widget } from 'public/static/charting_library';
import { datafeed } from './datafeed';

useEffect(() => {
  const tvWidget = new widget({
    symbol: 'BTC/USDT',
    interval: '5',              // 5分钟
    container_id: 'tv_chart',
    datafeed: datafeed,
    library_path: '/charting_library/',
    locale: 'zh',
    // 交易终端功能（需授权）
    trading_host: 'your-broker',
    broker_factory: yourBrokerFactory,
  });
  return () => tvWidget.remove();
}, []);