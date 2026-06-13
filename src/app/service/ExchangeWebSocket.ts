/**
 * ExchangeWebSocket — 交易所 WebSocket 生产级封装 (Pub/Sub 版)
 *
 * 功能：
 *   - 心跳检测 (ping/pong) 与 RTT 测量
 *   - 断线自动重连（指数退避，最多 maxRetry 次）
 *   - 重连超限后通过 bus.emit('$error:max-retry') 通知
 *   - 网络/页面恢复后订阅自动重放
 *   - Page Visibility API 处理 inactive / active 切换
 *   - 内置 EventBus：业务层按 channel 精确/通配符订阅数据
 */

import { EventBus, type Handler } from './EventBus';

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export type ConnectionState =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'CLOSED'
  | 'ERROR';

/** 系统级事件 map，业务数据 topic 为动态 string，统一用 bus.on 处理 */
export interface SystemEvents {
  /** 连接状态变更 */
  '$state': ConnectionState;
  /** 心跳往返延迟（ms） */
  '$latency': number;
  /** 达到最大重连次数 */
  '$error:max-retry': { retryCount: number };
  /** 订阅重放完成 */
  '$replay': { channels: string[] };
}

export interface ExchangeWSConfig {
  url: string;
  /** 心跳发送间隔（ms），默认 10000 */
  heartbeatInterval?: number;
  /** 心跳响应超时（ms），默认 5000 */
  heartbeatTimeout?: number;
  /** 最大重连次数，默认 5 */
  maxRetry?: number;
  /** 重连退避延迟序列（ms） */
  retryDelays?: number[];
  /**
   * 从服务端消息中解析出 channel 和 data 的函数。
   * 返回 null 表示该消息不需要路由（如系统消息）。
   *
   * 示例（OKX）：
   *   (msg) => msg.arg ? { channel: `${msg.arg.channel}:${msg.arg.instId}`, data: msg.data } : null
   */
  parseMessage?: (msg: Record<string, unknown>) => { channel: string; data: unknown } | null;
}

interface SubscriptionEntry {
  channel: string;
  params?: Record<string, unknown>;
}

// ─── 默认消息解析器（通用格式：{ channel, data }）─────────────────────────────

function defaultParseMessage(msg: Record<string, unknown>) {
  if (typeof msg.channel === 'string') {
    return { channel: msg.channel, data: msg.data ?? msg };
  }
  return null;
}

// ─── ExchangeWebSocket ────────────────────────────────────────────────────────

export class ExchangeWebSocket {
  /** 对外暴露的事件总线，业务层直接 .on() / .off() */
  readonly bus: EventBus<SystemEvents & Record<string, unknown>>;

  private config: Required<ExchangeWSConfig>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'CLOSED';

  private retryCount = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** 订阅注册表：channel → 订阅参数（用于重放） */
  private subscriptions = new Map<string, SubscriptionEntry>();

  private manualClose = false;
  private lastPingTs = 0;

  constructor(config: ExchangeWSConfig) {
    this.config = {
      heartbeatInterval: 10_000,
      heartbeatTimeout: 5_000,
      maxRetry: 5,
      retryDelays: [1000, 2000, 4000, 8000, 15_000],
      parseMessage: defaultParseMessage,
      ...config,
    };
    this.bus = new EventBus();
    this.bindVisibilityChange();
  }

  // ─── 公开 API ─────────────────────────────────────────────────────────────

  /** 建立连接 */
  connect(): void {
    if (this.state === 'CONNECTED' || this.state === 'CONNECTING') return;
    this.manualClose = false;
    this.retryCount = 0;
    this.doConnect();
  }

  /** 主动断开，不触发重连 */
  disconnect(): void {
    this.manualClose = true;
    this.cleanup();
    this.setState('CLOSED');
  }

  /**
   * 订阅一个行情频道
   *
   * - 若已连接：立即发送 subscribe 消息
   * - 若未连接：加入注册表，连接成功后自动重放
   * - 返回 unsubscribe 函数，可直接在 useEffect cleanup 中调用
   *
   * @param channel  业务 channel 标识，与服务端协议一致
   * @param handler  收到该 channel 数据时的回调
   * @param params   额外订阅参数（透传给服务端）
   */
  subscribe<T = unknown>(
    channel: string,
    handler: Handler<T>,
    params?: Record<string, unknown>,
  ): () => void {
    // 注册到 bus
    const offBus = this.bus.on(channel, handler as Handler<unknown>);

    // 注册到重放表（去重）
    if (!this.subscriptions.has(channel)) {
      const entry: SubscriptionEntry = { channel, params };
      this.subscriptions.set(channel, entry);

      if (this.state === 'CONNECTED') {
        this.sendSubscribe(entry);
      }
    }

    // 返回完整的清理函数
    return () => {
      offBus();
      // 若该 channel 已无任何监听者，向服务端发送 unsubscribe 并清出重放表
      if (this.bus.listenerCount(channel) === 0) {
        this.subscriptions.delete(channel);
        if (this.state === 'CONNECTED') {
          this.sendRaw({ type: 'unsubscribe', channel, ...params });
        }
      }
    };
  }

  /**
   * 仅在 bus 层订阅（不向服务端发 subscribe），
   * 适用于已由其他地方订阅、只需额外监听的场景
   */
  on<T = unknown>(channel: string, handler: Handler<T>): () => void {
    return this.bus.on(channel, handler as Handler<unknown>);
  }

  /** 发送任意原始消息 */
  sendRaw(payload: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  getState(): ConnectionState {
    return this.state;
  }

  /** 手动重连（适合弹窗"重试"按钮） */
  reconnect(): void {
    this.retryCount = 0;
    this.manualClose = false;
    this.cleanup();
    this.doConnect();
  }

  /** 销毁实例，清理所有资源 */
  destroy(): void {
    this.disconnect();
    this.bus.clear();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  // ─── 连接管理 ─────────────────────────────────────────────────────────────

  private doConnect(isRetry = false): void {
    this.setState(isRetry ? 'RECONNECTING' : 'CONNECTING');

    try {
      this.ws = new WebSocket(this.config.url);
    } catch (err) {
      console.error('[ExchangeWS] WebSocket 创建失败', err);
      this.handleUnexpectedClose();
      return;
    }

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.setState('CONNECTED');
      this.startHeartbeat();
      if (isRetry && this.subscriptions.size > 0) {
        this.replaySubscriptions();
      }
    };

    this.ws.onmessage = (event: MessageEvent) => this.handleMessage(event);

    this.ws.onerror = (event: Event) => {
      console.error('[ExchangeWS] 连接错误', event);
    };

    this.ws.onclose = (event: CloseEvent) => {
      if (this.manualClose) return;
      console.warn(`[ExchangeWS] 连接关闭 code=${event.code}`);
      this.stopHeartbeat();
      this.handleUnexpectedClose();
    };
  }

  private handleMessage(event: MessageEvent): void {
    let msg: unknown;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      msg = event.data;
    }

    const record = msg as Record<string, unknown>;

    // 处理 pong
    if (record?.type === 'pong') {
      const rtt = Date.now() - (record.ts as number ?? this.lastPingTs);
      clearTimeout(this.heartbeatTimeoutTimer!);
      this.bus.emit('$latency', rtt);
      return;
    }

    // 路由到对应 channel
    const parsed = this.config.parseMessage(record);
    if (parsed) {
      this.bus.emit(parsed.channel, parsed.data);
    }
  }

  private handleUnexpectedClose(): void {
    this.stopHeartbeat();

    if (this.retryCount >= this.config.maxRetry) {
      this.setState('ERROR');
      this.bus.emit('$error:max-retry', { retryCount: this.retryCount });
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const { retryDelays } = this.config;
    const delay = retryDelays[Math.min(this.retryCount, retryDelays.length - 1)];
    this.retryCount += 1;
    console.log(`[ExchangeWS] ${delay}ms 后第 ${this.retryCount} 次重连`);

    this.reconnectTimer = setTimeout(() => this.doConnect(true), delay);
  }

  private replaySubscriptions(): void {
    const channels: string[] = [];
    this.subscriptions.forEach((entry) => {
      this.sendSubscribe(entry);
      channels.push(entry.channel);
    });
    console.log(`[ExchangeWS] 重放 ${channels.length} 个订阅`);
    this.bus.emit('$replay', { channels });
  }

  private sendSubscribe(entry: SubscriptionEntry): void {
    this.sendRaw({ type: 'subscribe', channel: entry.channel, ...entry.params });
  }

  // ─── 心跳 ─────────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.lastPingTs = Date.now();
      this.ws.send(JSON.stringify({ type: 'ping', ts: this.lastPingTs }));

      this.heartbeatTimeoutTimer = setTimeout(() => {
        console.warn('[ExchangeWS] 心跳超时，强制重连');
        this.ws?.close(4000, 'heartbeat timeout');
      }, this.config.heartbeatTimeout);
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.heartbeatTimeoutTimer) { clearTimeout(this.heartbeatTimeoutTimer); this.heartbeatTimeoutTimer = null; }
  }

  // ─── Page Visibility ──────────────────────────────────────────────────────

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      console.log('[ExchangeWS] 页面 inactive，暂停心跳');
      this.stopHeartbeat();
    } else {
      console.log('[ExchangeWS] 页面 active，恢复检查');
      if (this.state === 'CONNECTED') {
        this.startHeartbeat();
        if (this.subscriptions.size > 0) this.replaySubscriptions();
      } else if (this.state !== 'CONNECTING' && this.state !== 'RECONNECTING') {
        this.retryCount = 0;
        this.doConnect(true);
      }
    }
  };

  private bindVisibilityChange(): void {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  // ─── 工具 ─────────────────────────────────────────────────────────────────

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.bus.emit('$state', next);
  }

  private cleanup(): void {
    clearTimeout(this.reconnectTimer!);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
  }
}