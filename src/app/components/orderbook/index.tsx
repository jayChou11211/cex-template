// components/orderbook/OrderBook.tsx
'use client';

import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Side = 'buy' | 'sell';

export interface DepthLevel {
  price: number;
  amount: number;
}

export interface OrderBookData {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

interface Props {
  wsUrl?: string;
  precisionOptions?: number[];
  defaultPrecision?: number;
  maxRows?: number;
}

interface WorkerDepthItem extends DepthLevel {
  total: number;
  percent: number;
}

interface WorkerResult {
  bids: WorkerDepthItem[];
  asks: WorkerDepthItem[];
}

export default function OrderBook({
  wsUrl,
  precisionOptions = [0.1, 1, 10],
  defaultPrecision = 0.1,
  maxRows = 20,
}: Props) {
  const [precision, setPrecision] =
    useState(defaultPrecision);

  const [activeSide, setActiveSide] =
    useState<Side>('buy');

  const [depth, setDepth] =
    useState<WorkerResult>({
      bids: [],
      asks: [],
    });

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./orderbook.worker.ts', import.meta.url),
      {
        type: 'module',
      },
    );

    workerRef.current.onmessage = (
      e: MessageEvent<WorkerResult>,
    ) => {
      setDepth(e.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  /**
   * mock websocket
   */
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const generateMockData = (): OrderBookData => {
      const mid = 100000;

      const bids = Array.from({
        length: 200,
      }).map((_, i) => ({
        price: mid - i * Math.random() * 10,
        amount: Math.random() * 5,
      }));

      const asks = Array.from({
        length: 200,
      }).map((_, i) => ({
        price: mid + i * Math.random() * 10,
        amount: Math.random() * 5,
      }));

      return {
        bids,
        asks,
      };
    };

    timer = setInterval(() => {
      workerRef.current?.postMessage({
        data: generateMockData(),
        precision,
        maxRows,
      });
    }, 300);

    return () => clearInterval(timer);
  }, [precision, maxRows, wsUrl]);

  const currentRows = useMemo(() => {
    return activeSide === 'buy'
      ? depth.bids
      : depth.asks;
  }, [activeSide, depth]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-[#0B0E11] text-xs text-white">
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        {/* side switch */}
        <div className="flex overflow-hidden rounded-md border border-zinc-700">
          <button
            onClick={() => setActiveSide('buy')}
            className={`px-4 py-1.5 font-medium transition-all ${
              activeSide === 'buy'
                ? 'bg-emerald-500 text-white'
                : 'bg-transparent text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            买盘
          </button>

          <button
            onClick={() => setActiveSide('sell')}
            className={`px-4 py-1.5 font-medium transition-all ${
              activeSide === 'sell'
                ? 'bg-red-500 text-white'
                : 'bg-transparent text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            卖盘
          </button>
        </div>

        {/* precision */}
        <select
          value={precision}
          onChange={(e) =>
            setPrecision(Number(e.target.value))
          }
          className="rounded-md border border-zinc-700 bg-[#181A20] px-3 py-1.5 text-zinc-300 outline-none"
        >
          {precisionOptions.map((item) => (
            <option key={item} value={item}>
              深度合并 {item}
            </option>
          ))}
        </select>
      </div>

      {/* header */}
      <div className="grid grid-cols-3 border-b border-zinc-800 px-3 py-2 text-zinc-500">
        <span>价格</span>
        <span className="text-right">数量</span>
        <span className="text-right">累计</span>
      </div>

      {/* list */}
      <div className="h-[600px] overflow-y-auto">
        {currentRows.map((item) => (
          <div
            key={`${activeSide}-${item.price}`}
            className="relative grid grid-cols-3 overflow-hidden px-3 py-1.5 hover:bg-white/[0.02]"
          >
            {/* depth bg */}
            <div
              className={`absolute right-0 top-0 h-full ${
                activeSide === 'buy'
                  ? 'bg-emerald-500/10'
                  : 'bg-red-500/10'
              }`}
              style={{
                width: `${item.percent}%`,
              }}
            />

            {/* price */}
            <span
              className={`relative z-10 font-medium ${
                activeSide === 'buy'
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {item.price.toFixed(2)}
            </span>

            {/* amount */}
            <span className="relative z-10 text-right text-zinc-300">
              {item.amount.toFixed(4)}
            </span>

            {/* total */}
            <span className="relative z-10 text-right text-zinc-400">
              {item.total.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MemoOrderBook = memo(OrderBook);