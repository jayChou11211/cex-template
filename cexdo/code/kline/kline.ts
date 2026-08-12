import React, { useEffect, useState, useMemo } from 'react';
import type { ISymbolTypeComponentProps } from './../component-module-props';
import type { IKlineConfig } from './kline-config';
import TradingView from './trading-view';
import useTheme from '@/hooks/useTheme';
import useRedGreenDirection from '@/hooks/useColorMode';
import { useTimeZoneStore } from '@/stores/trade/time-zone-store';
import { isDev } from '@/utils/env';
import KlineHeader from './../../components/kline-volume-period';
import { DEFAULT_PERIOD, formatSymbolForTradingView } from './utils';
import useLanguage from '@/hooks/useLanguage';

export const KLine = React.memo((props: ISymbolTypeComponentProps<IKlineConfig>) => {
    const { symbolInfo, tabId, config } = props;
    const { symbol, businessType } = symbolInfo;
    const { defaultPeriod } = config;
    
    // 状态管理
    const [period, setPeriod] = useState(defaultPeriod || DEFAULT_PERIOD);
    
    // 当默认周期变化时更新状态
    useEffect(() => {
        setPeriod(defaultPeriod);
    }, [defaultPeriod]);
    
    // 获取主题和颜色模式
    const { theme } = useTheme();
    const { colorMode } = useRedGreenDirection();
    
    // 获取时区和语言
    const timezone = useTimeZoneStore(state => state.timeZone);
    const language = useLanguage();
    
    // 计算TradingView组件所需的属性
    const tradingViewProps = useMemo(() => {
        return {
            tabId: tabId.split('-')[0], // 处理tabId格式
            symbol: formatSymbolForTradingView(symbol, businessType), // 格式化交易对符号
            period,
            theme,
            colorMode,
            timezone,
            libraryPath: isDev 
                ? '/charting_library/' 
                : '/trade-static/charting_library/', // 根据环境切换库路径
            customCssUrl: isDev 
                ? '/charting_library/custom.css' 
                : '/trade-static/charting_library/custom.css', // 根据环境切换CSS路径
            language,
        };
    }, [tabId, symbol, businessType, theme, colorMode, timezone, period, language]);
    
    return (
        <div className="flex flex-col h-full">
            <KlineHeader period={period} onChangePeriod={setPeriod} />
            <TradingView {...tradingViewProps} />
        </div>
    );
});

KLine.displayName = 'KLine';