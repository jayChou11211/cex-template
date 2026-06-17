// 类型别名：价格（使用整数，如 5000010000 代表 50000.1）
type Price = number;
type Size = number;
type Level = [Price, Size]; // [价格, 数量]

// 增量更新数据（通常由 WebSocket 推送）
interface DepthDelta {
    seq: number;
    bids: Level[]; // 变动的买盘档位
    asks: Level[]; // 变动的卖盘档位
}

// 扩展的数据结构，包含累计和百分比
interface DepthLevelWithStats {
    price: Price;
    size: Size;
    cumulative: Size;   // 累加数量（从最优价开始）
    percentage: number; // 百分比（0-100）
}

class OrderBookDepth {
    // 核心存储：使用 Map 保证 O(1) 更新
    private bids: Map<Price, Size> = new Map();
    private asks: Map<Price, Size> = new Map();

    /**
     * 1. 初始化或重置全量快照
     * 用于连接建立时或跳号恢复后，直接覆盖全部数据
     */
    public applySnapshot(snapshot: { bids: Level[]; asks: Level[] }) {
        // 清空旧数据
        this.bids.clear();
        this.asks.clear();

        // 批量插入买盘
        for (const [price, size] of snapshot.bids) {
            if (size > 0) this.bids.set(price, size);
        }
        // 批量插入卖盘
        for (const [price, size] of snapshot.asks) {
            if (size > 0) this.asks.set(price, size);
        }
    }

    /**
     * 2. 核心合并函数：将增量（Delta）合并到当前订单簿
     * 这是每秒被调用上千次的热点方法，务必保持高效
     */
    public mergeDelta(delta: DepthDelta) {
        // 合并买盘（Bids）
        this.mergeSide(this.bids, delta.bids);
        // 合并卖盘（Asks）
        this.mergeSide(this.asks, delta.asks);
    }

    /**
     * 单侧合并逻辑（复用代码）
     */
    private mergeSide(book: Map<Price, Size>, updates: Level[]) {
        for (let i = 0; i < updates.length; i++) {
            const [price, size] = updates[i];
            if (size === 0) {
                // 数量为 0 表示该价格档位被撤销，从 Map 中删除
                book.delete(price);
            } else {
                // 数量大于 0，直接覆盖（新增或更新）
                book.set(price, size);
            }
        }
    }

    /**
     * 3. 获取深度（Top N 档）
     * 排序是在读取时进行的，不影响写入性能
     */
    public getTopLevels(limit: number = 100): { bids: Level[]; asks: Level[] } {
        // 买盘：降序排列（价格高到低）
        const sortedBids = Array.from(this.bids.entries())
            .sort((a, b) => b[0] - a[0])  // 降序
            .slice(0, limit)
            .map(([price, size]) => [price, size] as Level);

        // 卖盘：升序排列（价格低到高）
        const sortedAsks = Array.from(this.asks.entries())
            .sort((a, b) => a[0] - b[0])  // 升序
            .slice(0, limit)
            .map(([price, size]) => [price, size] as Level);

        return { bids: sortedBids, asks: sortedAsks };
    }

    /**
     * 4. 获取最佳买卖价（便于快速计算价差，避免全量排序）
     */
    public getBestPrice() {
        let bestBid = 0;
        let bestAsk = Infinity;
        // 遍历买盘找最大价格（O(n) 但通常只用于展示，若高频可另维护变量）
        for (const [price] of this.bids) {
            if (price > bestBid) bestBid = price;
        }
        for (const [price] of this.asks) {
            if (price < bestAsk) bestAsk = price;
        }
        return { bestBid, bestAsk };
    }


    /**
     * 获取带有累计数量和百分比的深度数据
     * @param limit 返回的档位数（不指定则返回全部）
     * @param side 'bids' 或 'asks'
     * @returns 带有统计信息的深度数组（从最优价格开始）
     */
    public getDepthWithCumulative(
        side: 'bids' | 'asks',
        limit?: number
    ): DepthLevelWithStats[] {
        const book = side === 'bids' ? this.bids : this.asks;
        // 1. 提取并排序
        const sorted = Array.from(book.entries());
        if (side === 'bids') {
            // 买盘：降序（价格从高到低）
            sorted.sort((a, b) => b[0] - a[0]);
        } else {
            // 卖盘：升序（价格从低到高）
            sorted.sort((a, b) => a[0] - b[0]);
        }

        // 限制数量
        const levels = limit && limit > 0 ? sorted.slice(0, limit) : sorted;

        // 2. 计算总数量（用于百分比）
        let total = 0;
        for (const [, size] of sorted) {
            total += size;
        }

        // 3. 计算累计和百分比
        let cumulative = 0;
        const result: DepthLevelWithStats[] = [];
        for (const [price, size] of levels) {
            cumulative += size;
            const percentage = total > 0 ? (cumulative / total) * 100 : 0;
            result.push({
                price,
                size,
                cumulative,
                percentage,
            });
        }

        return result;
    }

    /**
     * 便捷方法：同时获取买盘和卖盘的统计深度（用于UI展示）
     */
    public getFullDepthWithCumulative(limit?: number) {
        return {
            bids: this.getDepthWithCumulative('bids', limit),
            asks: this.getDepthWithCumulative('asks', limit),
        };
    }
}