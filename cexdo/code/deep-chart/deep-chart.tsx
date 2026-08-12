import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { DepthChartConfig } from './depth-chart-config';
import type { SymbolTypeComponentProps } from './component-module-props';
import Konva from 'konva';
import { useSize } from 'ahooks';
import { DepthChartSubscribeManager } from './depth-chart-subscribe-manager';
import { useDepthChartStore } from '@/stores/trade/depth-chart-store';
import { useYAxis } from './useYAxis';
import { useXAxis } from './useXAxis';
import { useAsksBidsContent } from './useAsksBidsContent';
import { useTooltip } from './useTooltip';
import { usePoints } from './usePoints';
import { ExLoading } from '@/components/ex-loading';
import { depthWorker, WorkerMessageChannelEnum } from '@/utils/web-worker';
import useTheme from '@/hooks/useTheme';
import { fmt_X } from '@/utils/format-number';

export const DepthChart = React.memo((props: SymbolTypeComponentProps<DepthChartConfig>) => {
  const { symbolInfo, tabId } = props;
  const { symbol, businessType, mergeDepth, pricePrecision } = symbolInfo || {};
  const minGroup = mergeDepth?.split('.')[0] || '0.0';
  
  // Refs
  const stageRef = useRef<Konva.Stage | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const tooltipLayerRef = useRef<Konva.Layer | null>(null);
  const depthChartRef = useRef<HTMLDivElement>(null);
  
  // Hooks
  const { width = 0, height = 0 } = useSize(depthChartRef) || {};
  const { updateYAxisDivider, updateYAxisLabels } = useYAxis();
  const { updateXAxisDivider, updateXAxisLabels } = useXAxis();
  const { updateAsksBidsAxisDivider, updateAsksBidsContent } = useAsksBidsContent();
  const { createTooltip, clearTooltip, updateUI, hideUI, showUI } = useTooltip();
  const { theme } = useTheme();
  const { getPoints } = usePoints();
  
  // Store data
  const { 
    a = [], 
    b = [], 
    yLabels = [] 
  } = useDepthChartStore(state => {
    const streamPath = DepthChartSubscribeManager.createDepthChartStreamPath(
      businessType, 
      symbol, 
      minGroup
    );
    return state.findDepth(streamPath);
  }) || {};
  
  const hasData = a.length > 0 || b.length > 0;

  // Initialize Konva stage and layers
  useLayoutEffect(() => {
    if (!hasData || !depthChartRef.current || stageRef.current) return;
    
    // Create Konva stage
    stageRef.current = new Konva.Stage({
      container: depthChartRef.current,
      width,
      height,
    });
    
    // Create layers
    layerRef.current = new Konva.Layer();
    tooltipLayerRef.current = new Konva.Layer();
    
    // Add layers to stage
    stageRef.current.add(layerRef.current);
    stageRef.current.add(tooltipLayerRef.current);
    
    // Setup tooltip
    createTooltip(tooltipLayerRef.current);
    
    // Mouse event handlers
    const mousemoveHandler = () => {
      showUI();
      updateUI(stageRef.current, undefined, undefined, symbolInfo);
    };
    
    const mouseleaveHandler = () => {
      hideUI();
    };
    
    // Attach events
    stageRef.current.on('mousemove', mousemoveHandler);
    stageRef.current.on('mouseleave', mouseleaveHandler);
    
    // Layer ordering
    tooltipLayerRef.current.moveToTop();
    
    // Cleanup function
    return () => {
      clearTooltip();
      stageRef.current?.off('mousemove', mousemoveHandler);
      stageRef.current?.off('mouseleave', mouseleaveHandler);
      stageRef.current?.destroy();
      stageRef.current = null;
      layerRef.current = null;
      tooltipLayerRef.current = null;
    };
  }, [hasData, width, height, theme, createTooltip, clearTooltip, updateUI, hideUI, showUI, symbolInfo]);

  // Update chart when data or dimensions change
  useLayoutEffect(() => {
    if (stageRef.current && layerRef.current) {
      const stage = stageRef.current;
      
      // Clear previous content
      layerRef.current.destroyChildren();
      
      // Get points for asks and bids
      const { askPoints, bidPoints } = getPoints(stage, a, b);
      
      // Update axes
      updateXAxisDivider(stage, layerRef.current);
      updateXAxisLabels(stage, layerRef.current, yLabels);
      updateYAxisDivider(stage, layerRef.current);
      
      // Calculate and format mid price
      const askPrice = askPoints[0]?.[2]?.toString().replace(/,/g, '');
      const bidPrice = bidPoints[0]?.[2]?.toString().replace(/,/g, '');
      
      const midPrice = askPrice && bidPrice
        ? (Number(askPrice) + Number(bidPrice)) / 2
        : askPrice
          ? Number(askPrice)
          : bidPrice
            ? Number(bidPrice)
            : 0.0;
      
      const formattedMidPrice = fmt_X(midPrice, pricePrecision);
      
      // Update labels with mid price
      updateYAxisLabels(stage, layerRef.current, [bidPoints, askPoints], formattedMidPrice);
      
      // Update asks and bids content
      updateAsksBidsAxisDivider(stage, layerRef.current);
      updateAsksBidsContent(
        stage,
        layerRef.current,
        askPoints as unknown as number[],
        bidPoints as unknown as number[]
      );
      
      // Render updates
      layerRef.current.batchDraw();
      
      // Update tooltip
      updateUI(stage, askPoints as unknown as number[], bidPoints as unknown as number[]);
    }
  }, [
    theme,
    a,
    b,
    yLabels,
    width,
    height,
    updateYAxisDivider,
    updateYAxisLabels,
    updateXAxisDivider,
    updateXAxisLabels,
    updateAsksBidsAxisDivider,
    updateAsksBidsContent,
    pricePrecision,
    getPoints,
    updateUI
  ]);

  // Handle canvas resize
  useEffect(() => {
    if (width && stageRef.current) {
      // Update stage size
      stageRef.current.width(width);
      stageRef.current.height(height);
      
      // Notify web worker about resize
      depthWorker.postMessage({
        channel: WorkerMessageChannelEnum.TRADE_DEPTH_CHART,
        payload: {
          canvasWidth: width,
        },
        scope: 'depth-chart-resize',
      });
    }
  }, [width, height, tabId]);

  // Subscribe to data updates
  useEffect(() => {
    return DepthChartSubscribeManager.tabMount(
      tabId, 
      symbol, 
      businessType, 
      minGroup
    );
  }, [tabId, businessType, symbol, minGroup]);

  return (
    <div className='w-full h-full select-none'>
      {hasData ? (
        <div ref={depthChartRef} className='w-full h-full'></div>
      ) : (
        <div className='w-full h-full flex items-center justify-center'>
          <ExLoading />
        </div>
      )}
    </div>
  );
});

DepthChart.displayName = 'DepthChart';