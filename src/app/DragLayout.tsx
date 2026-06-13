'use client';

import GridLayout from 'react-grid-layout';
import KlinePanel from '../panels/KlinePanel';
import OrderBookPanel from '../panels/OrderBookPanel';
import RecentTradesPanel from '../panels/RecentTradesPanel';

export default function DragLayout() {
  const layout = [
    { i: 'kline', x: 0, y: 0, w: 8, h: 12 },
    { i: 'orderbook', x: 8, y: 0, w: 2, h: 12 },
    { i: 'trades', x: 10, y: 0, w: 2, h: 12 }
  ];

  return (
    <GridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={50}
      width={1400}
    >
      <div key="kline">
        <KlinePanel />
      </div>

      <div key="orderbook">
        <OrderBookPanel />
      </div>

      <div key="trades">
        <RecentTradesPanel />
      </div>
    </GridLayout>
  );
}