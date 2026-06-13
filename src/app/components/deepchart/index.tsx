// components/DeepChart.tsx
'use client';

import React, { useRef, useEffect, useCallback } from 'react';

// ---------- 类型定义 ----------
export interface DepthPoint {
  price: number;
  size: number;
}

export interface DeepChartProps {
  bids: DepthPoint[];
  asks: DepthPoint[];
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
}

interface CumPoint {
  price: number;
  cumSize: number;
}

// ---------- 组件 ----------
const DeepChart: React.FC<DeepChartProps> = ({
  bids,
  asks,
  width = 600,
  height = 400,
  margin = { top: 20, right: 30, bottom: 30, left: 50 },
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // 缓存预处理数据（深度图累积量、价格范围等）
  const processedDataRef = useRef<{
    bidsCum: CumPoint[];
    asksCum: CumPoint[];
    maxCum: number;
    priceMin: number;
    priceMax: number;
  } | null>(null);

  // 鼠标交互性能优化：使用 rAF 节流，避免过度重绘
  const rafIdRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; inChart: boolean }>({
    x: 0,
    y: 0,
    inChart: false,
  });

  // ---------- 辅助：二分查找最近累积量（性能优于全遍历）----------
  const findClosestCumSize = (arr: CumPoint[], price: number): number => {
    if (arr.length === 0) return 0;
    let low = 0;
    let high = arr.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (arr[mid].price < price) low = mid + 1;
      else high = mid;
    }
    // 找到最接近 target 的元素
    let closest = arr[low];
    if (low > 0 && Math.abs(arr[low - 1].price - price) < Math.abs(closest.price - price)) {
      closest = arr[low - 1];
    }
    return closest.cumSize;
  };

  // ---------- 底层深度图绘制 ----------
  const drawBackground = useCallback(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { top, bottom, left, right } = margin;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const centerX = left + chartWidth / 2;

    if (bids.length === 0 && asks.length === 0) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    const bidsSorted = [...bids].sort((a, b) => b.price - a.price);
    const asksSorted = [...asks].sort((a, b) => a.price - b.price);

    // 累积量计算
    const bidsCum: CumPoint[] = [];
    let sum = 0;
    for (const b of bidsSorted) {
      sum += b.size;
      bidsCum.push({ price: b.price, cumSize: sum });
    }

    const asksCum: CumPoint[] = [];
    sum = 0;
    for (const a of asksSorted) {
      sum += a.size;
      asksCum.push({ price: a.price, cumSize: sum });
    }

    const totalBidSize = bidsCum.length > 0 ? bidsCum[bidsCum.length - 1].cumSize : 0;
    const totalAskSize = asksCum.length > 0 ? asksCum[asksCum.length - 1].cumSize : 0;
    const maxCum = Math.max(totalBidSize, totalAskSize, 1);

    const allPrices = [...bidsSorted.map(b => b.price), ...asksSorted.map(a => a.price)];
    let priceMin = Math.min(...allPrices);
    let priceMax = Math.max(...allPrices);
    const priceRange = priceMax - priceMin || 1;
    priceMin -= priceRange * 0.05;
    priceMax += priceRange * 0.05;

    processedDataRef.current = { bidsCum, asksCum, maxCum, priceMin, priceMax };

    const xScale = (chartWidth / 2) / maxCum;
    const yScale = chartHeight / (priceMax - priceMin);
    const getY = (price: number) => top + (priceMax - price) * yScale;

    ctx.clearRect(0, 0, width, height);

    // 网格
    ctx.strokeStyle = '#2a2e39';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = top + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();
    }

    // 中心线
    ctx.strokeStyle = '#5b5f6b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, top);
    ctx.lineTo(centerX, height - bottom);
    ctx.stroke();

    // 买单面积
    if (bidsCum.length > 0) {
      ctx.beginPath();
      ctx.moveTo(centerX, getY(bidsCum[0].price));
      for (const p of bidsCum) {
        const x = centerX - p.cumSize * xScale;
        const y = getY(p.price);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(centerX, getY(bidsCum[bidsCum.length - 1].price));
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 200, 100, 0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 200, 100, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 卖单面积
    if (asksCum.length > 0) {
      ctx.beginPath();
      ctx.moveTo(centerX, getY(asksCum[0].price));
      for (const p of asksCum) {
        const x = centerX + p.cumSize * xScale;
        const y = getY(p.price);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(centerX, getY(asksCum[asksCum.length - 1].price));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 80, 80, 0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 坐标轴标签
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Price', 5, top - 5);
  }, [bids, asks, width, height, margin]);

  useEffect(() => {
    drawBackground();
  }, [drawBackground]);

  // ---------- 在顶层 canvas 绘制十字线和 tooltip ----------
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = processedDataRef.current;
    if (!data) return;

    const { x, y, inChart } = mouseRef.current;
    ctx.clearRect(0, 0, width, height);
    if (!inChart) return;

    const { top, bottom, left, right } = margin;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const { priceMin, priceMax, bidsCum, asksCum } = data;
    const yScale = chartHeight / (priceMax - priceMin);

    // 计算鼠标对应价格
    let price = priceMax - (y - top) / yScale;
    price = Math.min(priceMax, Math.max(priceMin, price));

    // 二分查找最近累计量
    const bidSize = findClosestCumSize(bidsCum, price);
    const askSize = findClosestCumSize(asksCum, price);

    // 绘制十字虚线
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, height - bottom);
    ctx.stroke();
    ctx.setLineDash([]); // 重置

    // ---------- 绘制 tooltip（Canvas）----------
    const fontSize = 12;
    const lineHeight = 16;
    ctx.font = `${fontSize}px sans-serif`;

    const lines = [
      `Price: ${price.toFixed(2)}`,
      `Bid: ${bidSize.toFixed(4)}`,
      `Ask: ${askSize.toFixed(4)}`,
    ];

    // 计算文本宽度
    const textWidths = lines.map(l => ctx.measureText(l).width);
    const maxTextWidth = Math.max(...textWidths);
    const paddingX = 8;
    const paddingY = 6;
    const boxWidth = maxTextWidth + paddingX * 2;
    const boxHeight = lines.length * lineHeight + paddingY * 2;

    // 确定 tooltip 绘制位置（避免超出画布）
    let boxX = x + 15;
    let boxY = y - boxHeight - 10;
    if (boxX + boxWidth > width - right) boxX = x - boxWidth - 15;
    if (boxY < top) boxY = y + 15;

    // 确保不超出左侧
    boxX = Math.max(left, boxX);
    boxY = Math.max(top, boxY);

    // 绘制半透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // 绘制边框
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // 绘制文本
    ctx.fillStyle = '#d1d4dc';
    lines.forEach((line, i) => {
      const textY = boxY + paddingY + (i + 1) * lineHeight - 4;
      ctx.fillText(line, boxX + paddingX, textY);
    });
  }, [width, height, margin]);

  // ---------- 鼠标事件（性能优化：rAF 统一绘制）----------
  const scheduleOverlayUpdate = useCallback(() => {
    if (rafIdRef.current) return; // 已有绘制任务等待中
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      drawOverlay();
    });
  }, [drawOverlay]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        inChart: true,
      };
      scheduleOverlayUpdate();
    },
    [scheduleOverlayUpdate]
  );

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.inChart = false;
    // 取消可能排队的绘制
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    // 立即清空 overlay
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, width, height);
    }
  }, [width, height]);

  // 清理 rAF
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <div
      className="relative bg-[#131722]"
      style={{ width, height }}
    >
      {/* 底层：深度图 */}
      <canvas
        ref={bgCanvasRef}
        width={width}
        height={height}
        className="absolute left-0 top-0"
      />
      {/* 上层：鼠标交互（十字线 + Canvas tooltip） */}
      <canvas
        ref={overlayCanvasRef}
        width={width}
        height={height}
        className="absolute left-0 top-0"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

export default DeepChart;