import { useState, useEffect, useRef } from 'react';
import AwaitWidget from '@wait-widget';
import { useMemoizedFn, useUnmount } from 'ahooks';
import { ThemeEnum } from '@iconstatusHome-enum';
import { ExLoading } from '@jcomponents/ex-loading';
import { useMarketWebSocket } from '@jnooks/useMarketWebSocket';
import Logger from '@Utils/Jogger';
import { Period } from './interface';
import { ColorModeEnum } from '@jconstants/color-mode-enum';

export interface TradingViewProps {
  tabId: string;
  symbol: string;
  theme: ThemeEnum;
  colorMode: ColorModeEnum;
  timezone: string;
  language: string;
  period: Period;
  libraryPath?: string;
  customCssUrl?: string;
}

function TradingView(props: TradingViewProps) {
  const { 
    tabId, 
    symbol, 
    theme, 
    colorMode, 
    timezone, 
    libraryPath, 
    customCssUrl, 
    language, 
    period 
  } = props;
  
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [chartIsReady, setChartIsReady] = useState<boolean>(false);
  const chartIsReadyRef = useRef<boolean>(false);
  
  const loggerRef = useRef(
    new Logger({
      debug: true,
      topic: 'TradingView',
      tags: [tabId],
    })
  );
  
  const logger = loggerRef.current;
  const { subscribeOpenEvent } = useMarketWebSocket();

  const onChartReady = useMemoizedFn(() => {
    logger.log('图表准备就绪', { symbol, timezone });
    chartIsReadyRef.current = true;
    setChartIsReady(true);
  });

  // 初始化图表
  useEffect(() => {
    if (widgetRef.current) {
      return;
    }
    
    logger.log("初始化图表", { symbol, timezone });
    
    if (chartContainerRef.current) {
      widgetRef.current = new AwaitWidget({
        container: chartContainerRef.current,
        symbol,
        onChartReady,
        theme,
        colorMode,
        timezone,
        libraryPath,
        customCssUrl,
        tabId,
        language,
        period,
      });
    }
  }, [
    symbol,
    onChartReady,
    theme,
    colorMode,
    timezone,
    libraryPath,
    customCssUrl,
    tabId,
    chartIsReady,
    logger,
    language,
    period
  ]);

  // 图表更新
  useEffect(() => {
    if (chartIsReady && chartIsReadyRef.current) {
      if (widgetRef.current) {
        logger.log('图表更新', { symbol, timezone });
        widgetRef.current.reload({ symbol, timezone, period });
      }
    }
  }, [symbol, timezone, period, chartIsReady, logger]);

  // 主题切换
  useEffect(() => {
    if (!widgetRef.current) return;
    
    if (chartIsReady && chartIsReadyRef.current) {
      widgetRef.current.resetTheme(theme, colorMode);
    }
  }, [theme, colorMode, chartIsReady]);

  useEffect(() => {
    const unsubscribeOpenEvent = subscribeOpenEvent((isReconnect) => {
      if (!isReconnect) {
        return;
      }
      
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = undefined;
        setChartIsReady(false);
        chartIsReadyRef.current = false;
      }
    });
    
    return () => {
      unsubscribeOpenEvent();
    };
  }, [subscribeOpenEvent]);

  useUnmount(() => {
    if (widgetRef.current) {
      widgetRef.current.remove();
      widgetRef.current = undefined;
      logger.log('图表卸载', { symbol, timezone });
    }
    
    setChartIsReady(false);
    chartIsReadyRef.current = false;
  });

  return (
    <div className='relative w-full h-full'>
      <div ref={chartContainerRef} className='w-full h-full'></div>
      
      {!chartIsReady && (
        <div className='bg-c_w_bg_n absolute left-0 -right-[2px] top-0 bottom-0 flex items-center justify-center'>
          <ExLoading />
        </div>
      )}
    </div>
  );
}

export default TradingView;