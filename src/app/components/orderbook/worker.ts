// components/orderbook/orderbook.worker.ts

export interface DepthLevel {
  price: number;
  amount: number;
}

interface WorkerInput {
  data: {
    bids: DepthLevel[];
    asks: DepthLevel[];
  };

  precision: number;
  maxRows: number;
}

interface WorkerDepthItem extends DepthLevel {
  total: number;
  percent: number;
}

const mergeDepth = (
  list: DepthLevel[],
  precision: number,
  side: 'buy' | 'sell',
) => {
  const map = new Map<number, number>();

  for (const item of list) {
    const mergedPrice =
      side === 'buy'
        ? Math.floor(item.price / precision) *
          precision
        : Math.ceil(item.price / precision) *
          precision;

    map.set(
      mergedPrice,
      (map.get(mergedPrice) || 0) + item.amount,
    );
  }

  const merged = [...map.entries()].map(
    ([price, amount]) => ({
      price,
      amount,
    }),
  );

  merged.sort((a, b) =>
    side === 'buy'
      ? b.price - a.price
      : a.price - b.price,
  );

  return merged;
};

const calcDepth = (
  list: DepthLevel[],
): WorkerDepthItem[] => {
  let total = 0;

  const totals = list.map((item) => {
    total += item.amount;

    return {
      ...item,
      total,
    };
  });

  const maxTotal =
    totals[totals.length - 1]?.total || 1;

  return totals.map((item) => ({
    ...item,
    percent: (item.total / maxTotal) * 100,
  }));
};

self.onmessage = (
  e: MessageEvent<WorkerInput>,
) => {
  const { data, precision, maxRows } = e.data;

  const mergedBids = mergeDepth(
    data.bids,
    precision,
    'buy',
  ).slice(0, maxRows);

  const mergedAsks = mergeDepth(
    data.asks,
    precision,
    'sell',
  ).slice(0, maxRows);

  self.postMessage({
    bids: calcDepth(mergedBids),
    asks: calcDepth(mergedAsks),
  });
};