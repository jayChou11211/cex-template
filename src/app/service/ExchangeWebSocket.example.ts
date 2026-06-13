/**
 * ExchangeWebSocket 使用示例
 *
 * 场景：连接 OKX 行情 WebSocket，订阅 BTC/ETH 行情，
 *       超过最大重连次数时弹窗提示用户。
 */

import { ExchangeWebSocket } from './ExchangeWebSocket';

// ── 1. 初始化 ─────────────────────────────────────────────────────

const ws = new ExchangeWebSocket({
  url: 'wss://ws.okx.com:8443/ws/v5/public',

  heartbeatInterval: 10_000,   // 每 10s 发一次 ping
  heartbeatTimeout:  5_000,    // 5s 内未收到 pong 判定断线
  maxRetry:          5,        // 最多重试 5 次
  retryDelays: [1000, 2000, 4000, 8000, 15_000],  // 指数退避

  // ── 消息处理 ──────────────────────────────────────────────────
  onMessage(data) {
    const msg = data as Record<string, unknown>;

    if (msg.event === 'subscribe') {
      console.log('订阅成功', msg.arg);
      return;
    }

    if (msg.arg && msg.data) {
      const { channel } = msg.arg as { channel: string };
      console.log(`[${channel}]`, msg.data);
    }
  },

  // ── 状态监听 ──────────────────────────────────────────────────
  onStateChange(state) {
    console.log('[状态变更]', state);

    // 示例：更新 UI 连接指示灯
    const indicator = document.querySelector('#ws-status');
    if (indicator) {
      indicator.textContent = {
        CONNECTED: '● 已连接',
        CONNECTING: '◌ 连接中',
        RECONNECTING: '◌ 重连中',
        CLOSED: '○ 未连接',
        ERROR: '✕ 连接失败',
      }[state] ?? state;
    }
  },

  // ── 超过最大重连次数：弹窗提示 ────────────────────────────────
  onMaxRetryExceeded(retryCount) {
    console.error(`重连 ${retryCount} 次失败`);

    // 使用你的 UI 库弹窗（此处用原生 confirm 演示）
    const retry = window.confirm(
      `已尝试重连 ${retryCount} 次，无法连接到行情服务器。\n\n点击"确定"立即重试，"取消"稍后手动重连。`
    );

    if (retry) {
      ws.reconnect();
    }
  },

  // ── 订阅重放完成 ──────────────────────────────────────────────
  onReplayComplete(channels) {
    console.log('订阅重放完成', channels);
  },
});

// ── 2. 建立连接 ──────────────────────────────────────────────────

ws.connect();

// ── 3. 订阅频道（可在连接前调用，会在连接/重连后自动重放） ──────

ws.subscribe('tickers', { instId: 'BTC-USDT', instType: 'SPOT' });
ws.subscribe('tickers', { instId: 'ETH-USDT', instType: 'SPOT' });
ws.subscribe('books5',  { instId: 'BTC-USDT', instType: 'SPOT' });

// ── 4. 取消订阅 ──────────────────────────────────────────────────

// ws.unsubscribe('books5');

// ── 5. 主动断开（如页面卸载） ────────────────────────────────────

window.addEventListener('beforeunload', () => {
  ws.destroy();
});

// ── 6. React Hook 封装示例 ───────────────────────────────────────

/*
import { useEffect, useRef, useState } from 'react';

function useExchangeWS(url: string) {
  const wsRef = useRef<ExchangeWebSocket | null>(null);
  const [state, setState] = useState<ConnectionState>('CLOSED');

  useEffect(() => {
    const client = new ExchangeWebSocket({
      url,
      onStateChange: setState,
      onMaxRetryExceeded: () => {
        // 调用你的 Toast/Dialog 组件
      },
    });

    client.connect();
    wsRef.current = client;

    return () => client.destroy();
  }, [url]);

  return { ws: wsRef.current, state };
}
*/
