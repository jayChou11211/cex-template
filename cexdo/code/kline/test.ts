class AvenirWidget extends widget {
    // ... 其他代码保持不变 ...

    constructor(options: AvenirWidgetOptions) {
        // ... 原有构造逻辑 ...

        this.onChartReady(() => {
            this.logger.i('AvenirWidget onChartReady start');
            options.onChartReady?.();
            // 添加成交量指标初始化
            this._setVolumeInputValues();
        });
    }

    /**
     * 重新加载图表数据
     * @param options 重新加载参数
     */
    reload(options: { symbol: string; period: Period; timezone?: string }) {
        const { symbol, period, timezone } = options;
        const symbolChanged = this.symbol !== symbol;
        const timezoneChanged = this._getTimezone() !== timezone;
        const periodChanged = this._getPeriod() !== period;

        // 处理交易对变更
        if (symbolChanged) {
            this.symbol = symbol;
            // 获取当前分辨率
            const resolution = this.symbolInterval().interval;
            // 设置新交易对
            this.setSymbol(symbol, resolution, () => {
                this.logger.i('交易对切换完成', { symbol });
            });
        }

        // 处理周期变更
        if (periodChanged) {
            this.activeChart()?.setResolution(
                periodToResolution(period), 
                () => {
                    this.logger.i('周期切换完成', { period });
                }
            );
        }

        // 处理时区变更
        if (timezoneChanged && timezone) {
            try {
                this.chart()
                    ?.getTimezoneApi()
                    .setTimezone(timezone as Timezone);
                this.logger.i('时区切换完成', { timezone });
            } catch (error) {
                this.logger.w('设置时区错误', error);
            }
        }

        // 所有变更完成后刷新成交量指标
        if (symbolChanged || periodChanged) {
            this._setVolumeInputValues();
        }
    }

    // ... 其他方法保持不变 ...
}