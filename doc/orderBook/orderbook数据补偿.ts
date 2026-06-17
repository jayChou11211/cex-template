// 类型定义（与之前相同）
type PriceLevels = Map<number, number>;

interface DeltaMessage {
    seq: number;
    bids: [number, number][];
    asks: [number, number][];
}

interface SnapshotMessage {
    seq: number;
    bids: [number, number][];
    asks: [number, number][];
}

enum RecoveryState {
    Normal,      // 正常处理实时消息
    Recovering,  // 已请求快照，等待响应，正在缓存消息
    Replaying    // 快照已应用，正在回放缓存队列
}

class OrderBookManager {
    private bids: PriceLevels = new Map();
    private asks: PriceLevels = new Map();
    private lastSeq: number = 0;
    private state: RecoveryState = RecoveryState.Normal;

    // 消息缓存队列（补偿期间存放增量消息）
    private pendingQueue: DeltaMessage[] = [];
    // 标记是否正在处理回放（防止重入）
    private isReplaying: boolean = false;

    // 处理 WebSocket 消息的入口
    public handleMessage(message: DeltaMessage | SnapshotMessage) {
        // 如果是快照消息，走快照处理流程
        if (this.isSnapshot(message)) {
            this.applySnapshot(message);
            return;
        }

        // 增量消息
        const delta = message as DeltaMessage;

        // 根据当前状态决定如何处理
        switch (this.state) {
            case RecoveryState.Normal:
                // 正常状态，直接校验并应用
                this.processDelta(delta);
                break;
            case RecoveryState.Recovering:
                // 等待快照期间，缓存所有增量
                this.pendingQueue.push(delta);
                break;
            case RecoveryState.Replaying:
                // 回放期间，继续追加到队列尾部（保证顺序）
                this.pendingQueue.push(delta);
                // 如果回放尚未开始（即 isReplaying 为 false），则触发回放
                if (!this.isReplaying) {
                    this.replayPendingQueue();
                }
                break;
        }
    }

    // 处理正常状态下的增量（含跳号检测）
    private processDelta(delta: DeltaMessage) {
        if (delta.seq === this.lastSeq + 1) {
            this.applyDelta(delta);
            this.lastSeq = delta.seq;
        } else if (delta.seq > this.lastSeq + 1) {
            // 跳号！触发补偿
            console.error(`Jump detected: expected ${this.lastSeq + 1}, got ${delta.seq}. Starting recovery...`);
            this.startRecovery();
            // 当前这条消息也要缓存（因为已进入 Recovering 状态）
            this.pendingQueue.push(delta);
        } else {
            // 旧消息或重复消息，忽略
            console.warn(`Ignoring old/duplicate seq: ${delta.seq}`);
        }
    }

    // 启动补偿流程
    private async startRecovery() {
        // 防止重复触发
        if (this.state !== RecoveryState.Normal) return;

        // 1. 清空本地订单簿（可选，避免回退）
        this.bids.clear();
        this.asks.clear();
        // 2. 切换状态为 Recovering，后续增量将被缓存
        this.state = RecoveryState.Recovering;
        // 3. 请求快照（异步）
        try {
            const snapshot = await this.fetchSnapshot();
            // 4. 应用快照（内部会切换状态到 Replaying）
            this.applySnapshot(snapshot);
            // 5. 回放缓存队列
            await this.replayPendingQueue();
        } catch (error) {
            console.error("Snapshot fetch failed, retrying...", error);
            // 可以重试或降级，这里简单处理：等待后重试
            setTimeout(() => this.startRecovery(), 1000);
        }
    }

    // 获取快照（模拟 REST API 调用）
    private async fetchSnapshot(): Promise<SnapshotMessage> {
        // 实际使用 fetch 调用交易所 API
        const response = await fetch('https://api.exchange.com/api/v1/depth?symbol=BTCUSDT');
        const data = await response.json();
        return {
            seq: data.lastUpdateId, // 快照的序列号
            bids: data.bids,
            asks: data.asks,
        };
    }

    // 应用快照
    private applySnapshot(snapshot: SnapshotMessage) {
        this.bids = new Map(snapshot.bids);
        this.asks = new Map(snapshot.asks);
        this.lastSeq = snapshot.seq;
        // 切换到回放状态
        this.state = RecoveryState.Replaying;
        console.log(`Snapshot applied, lastSeq = ${this.lastSeq}`);
    }

    // 回放缓存队列
    private async replayPendingQueue() {
        if (this.isReplaying) return; // 防止并发
        this.isReplaying = true;

        console.log(`Replaying ${this.pendingQueue.length} pending messages...`);

        // 按顺序处理队列中的消息
        while (this.pendingQueue.length > 0) {
            // 取出最早的一条
            const delta = this.pendingQueue.shift()!;
            // 仅处理 seq > lastSeq 的消息（跳过已包含在快照中的）
            if (delta.seq > this.lastSeq) {
                // 校验连续性（此时应该连续，若不连续则可能再次跳号，极少数情况）
                if (delta.seq === this.lastSeq + 1) {
                    this.applyDelta(delta);
                    this.lastSeq = delta.seq;
                } else if (delta.seq > this.lastSeq + 1) {
                    // 罕见情况：回放过程中又发现跳号，说明快照不够新或队列有缺失
                    console.error(`Gap during replay: expected ${this.lastSeq + 1}, got ${delta.seq}. Restart recovery.`);
                    // 清空剩余队列，重新开始补偿
                    this.pendingQueue = [];
                    this.state = RecoveryState.Normal;
                    this.isReplaying = false;
                    this.startRecovery();
                    return;
                } else {
                    // seq <= lastSeq，跳过
                    continue;
                }
            }
        }

        // 队列处理完毕，恢复 Normal 状态
        this.state = RecoveryState.Normal;
        this.isReplaying = false;
        console.log(`Replay completed, current lastSeq = ${this.lastSeq}`);
    }

    // 应用增量更新（与之前相同）
    private applyDelta(delta: DeltaMessage) {
        delta.bids.forEach(([price, size]) => {
            if (size === 0) this.bids.delete(price);
            else this.bids.set(price, size);
        });
        delta.asks.forEach(([price, size]) => {
            if (size === 0) this.asks.delete(price);
            else this.asks.set(price, size);
        });
    }

    // 类型守卫
    private isSnapshot(msg: any): msg is SnapshotMessage {
        return msg && msg.type === 'snapshot';
    }
}