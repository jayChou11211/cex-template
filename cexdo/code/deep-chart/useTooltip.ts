import { useCallback, useRef } from 'react';
import Konva from 'konva';
import { getCSSVariable } from '@/utils/get-css-variable';
import { useKAAsTool } from '@/hooks/useKAAsTool';
import { useAAAsTool } from '@/hooks/useAAAsTool';
import { usePoints } from '@/hooks/usePoints';
import { MAX_TICKER_COUNT } from '@/constants';
import { DepthChartSubscribedManager } from '@/utils/depth-chart-subscribe-manager';
import { SymbolItem } from '@/interfaces/services/symbol-service';
import { useDepthChartStore } from '@/store/trade/depth-chart-store';
import { useTradeSettingsStore } from '@/store/trade/trade-setting-store';
import { ColorModeEnum } from '@/constants/color-mode-enum';
import { fmt_shorten, fmt_x } from '@/utils/format-number';

interface TooltipData {
  askPoints: number[][];
  bidPoints: number[][];
  quantityPrecision: number;
}

export function useTooltip() {
  const { getXAxisRect, getYAxisRect } = useKAAsTool();
  const { getStepSize, getSteps, getPoints } = usePoints();
  const tooltipGroupRef = useRef<Konva.Group>();
  const tooltipDataRef = useRef<TooltipData>();
  const isMouseOverRef = useRef<boolean>(false);
  
  const colorMode = useTradeSettingsStore(state => state.settings.colorMode);
  const isGreenUp = colorMode === ColorModeEnum.GREEN_UP_RED_DOWN;

  // 创建工具提示视图
  const createTooltipView = useCallback((isAsk = false) => {
    const redColor = { fill: 'rgba(214, 65, 68, 1)', stroke: 'rgba(214, 65, 68, 0.25)' };
    const greenColor = { fill: 'rgba(59, 163, 103, 1)', stroke: 'rgba(59, 163, 103, 0.25)' };
    const { fill, stroke } = isAsk 
      ? (isGreenUp ? redColor : greenColor) 
      : (isGreenUp ? greenColor : redColor);

    // 创建圆点
    const dot = new Konva.Circle({
      radius: 3,
      stroke,
      fill,
      strokeWidth: 6
    });

    // 创建虚线
    const line = new Konva.Line({
      points: [0, 0, 0, 0],
      stroke: getCSSVariable('--an-ul-c_003_n'),
      strokeWidth: 1,
      dash: [3, 3]
    });

    // 创建组容器
    const group = new Konva.Group({ x: 0, y: 0 });
    const dotDetailGroup = new Konva.Group({ x: 0, y: 0 });
    const detailGroup = new Konva.Group({ x: 0, y: 0 });

    // 创建背景矩形
    const rect = new Konva.Rect({
      cornerRadius: 8,
      stroke: getCSSVariable('--an-ul-c_s_n'),
      strokeWidth: 1,
      fill: getCSSVariable('--an-ul-c_cover_bg_n'),
      shadowColor: 'rgba(0, 0, 0, 0.05)',
      shadowBlur: 20,
      shadowOffset: { x: 0, y: 8 },
      shadowOpacity: 1
    });

    const rectPadding = 4;
    const titleTextStyles = {
      fontSize: 12,
      fontFamily: 'IBM Plex Sans',
      fill: getCSSVariable('--an-ul-c_001_n'),
      height: 24,
      width: 64,
      align: 'left',
      verticalAlign: 'middle',
      padding: 8
    };

    const valueTextStyles = {
      fontSize: 12,
      fontFamily: 'IBM Plex Sans',
      fill: getCSSVariable('--en-ul-c_101_r'),
      height: 24,
      width: 84,
      align: 'right',
      verticalAlign: 'middle',
      x: titleTextStyles.width + 4
    };

    // 创建文本元素
    const orderPriceTitleText = new Konva.Text({
      ...titleTextStyles,
      text: 'Order Price',
      x: 0,
      y: rectPadding
    });

    const ordersTitleText = new Konva.Text({
      ...titleTextStyles,
      text: 'Orders',
      x: 0,
      y: titleTextStyles.height + rectPadding
    });

    const orderPriceValueText = new Konva.Text({
      ...valueTextStyles,
      text: '0.0',
      y: rectPadding
    });

    const ordersValueText = new Konva.Text({
      ...valueTextStyles,
      text: '0.0',
      y: titleTextStyles.height + rectPadding
    });

    // 设置矩形尺寸
    rect.height(titleTextStyles.height * 2 + rectPadding * 2);
    rect.width(titleTextStyles.width + valueTextStyles.width + rectPadding * 2);

    // 组装元素
    detailGroup.add(
      rect,
      orderPriceTitleText,
      ordersTitleText,
      orderPriceValueText,
      ordersValueText
    );

    dotDetailGroup.add(dot, detailGroup);
    group.add(line, dotDetailGroup);
    return group;
  }, [colorMode]);

  // 创建工具提示覆盖层
  const createTooltipOverlay = useCallback(() => {
    return new Konva.Rect({
      x: 0,
      y: 0,
      fill: getCSSVariable('--an-ui-c_w_bg_r'),
      opacity: 0.8,
      width: 0,
      height: 0
    });
  }, []);

  // 创建完整工具提示
  const createTooltip = useCallback((layer: Konva.Layer) => {
    tooltipGroupRef.current?.destroy();
    
    const tooltipGroup = new Konva.Group({ 
      x: 0, 
      y: 0, 
      visible: false, 
      listening: false 
    });
    
    const bidsOverlay = createTooltipOverlay();
    const asksOverlay = createTooltipOverlay();
    const bidsTooltipGroup = createTooltipView(false);
    const asksTooltipGroup = createTooltipView(true);
    
    tooltipGroup.add(bidsOverlay, asksOverlay, bidsTooltipGroup, asksTooltipGroup);
    tooltipGroupRef.current = tooltipGroup;
    layer.add(tooltipGroup);
  }, [createTooltipOverlay, createTooltipView]);

  // 格式化数量显示
  const formatAmount = (amount: number | string) => {
    const normalizedAmount = String(amount).replace(/,/g, '');
    if (Number(normalizedAmount) >= 10000) {
      return fmt_shorten(normalizedAmount, 2);
    }
    return fmt_x(
      normalizedAmount, 
      tooltipDataRef.current?.quantityPrecision || 2
    );
  };

  // 更新工具提示UI
  const updateUI = useCallback((
    stage: Konva.Stage, 
    askPoints?: number[][], 
    bidPoints?: number[][], 
    symbolInfo?: SymbolItem
  ) => {
    if (!tooltipGroupRef.current || !tooltipGroupRef.current.isVisible()) return;

    let _bidPoints = bidPoints || tooltipDataRef.current?.bidPoints || [];
    let _askPoints = askPoints || tooltipDataRef.current?.askPoints || [];

    // 处理空数据情况
    if (_bidPoints.length === 0 && _askPoints.length === 0) {
      if (!symbolInfo) return;
      
      const { symbol, businessType, mergeDepth } = symbolInfo;
      const minGroup = mergeDepth.split('::')[0];
      const streamPath = DepthChartSubscribedManager.createDepthChartStreamPath(
        businessType, 
        symbol, 
        minGroup
      );
      
      const { a = [], b = [] } = useDepthChartStore.getState().findDepth(streamPath) || {};
      if (!a.length && !b.length) return;
      
      const points = getPoints(stage, a, b);
      _bidPoints = points.bidPoints as number[][];
      _askPoints = points.askPoints as number[][];
      
      if (!_bidPoints.length && !_askPoints.length) return;
    }

    try {
      const { w: xAxisWidth } = getXAxisRect(stage);
      const { h: yAxisHeight } = getYAxisRect(stage);
      const stepSize = getStepSize(stage);
      const steps = getSteps();

      // 获取工具提示子元素
      const [bidsOverlay, asksOverlay, bidsTooltipGroup, asksTooltipGroup] = 
        tooltipGroupRef.current.getChildren() as Konva.Shape[];
      
      const [bidsLine, bidsDotDetailGroup] = (bidsTooltipGroup as Konva.Group).getChildren();
      const [asksLine, asksDotDetailGroup] = (asksTooltipGroup as Konva.Group).getChildren();

      // 显示/隐藏提示
      bidsDotDetailGroup.visible(_bidPoints.length > 0);
      asksDotDetailGroup.visible(_askPoints.length > 0);

      // 计算位置
      const bidSteps = Math.min(
        steps,
        MAX_TICKER_COUNT - _bidPoints.length
      );
      
      const askSteps = Math.min(
        steps,
        MAX_TICKER_COUNT - _askPoints.length
      );

      const bidNextPos = {
        x: bidSteps * stepSize,
        y: _bidPoints[MAX_TICKER_COUNT - bidSteps - 1]?.[1] || 0
      };

      const askNextPos = {
        x: xAxisWidth - askSteps * stepSize,
        y: _askPoints[MAX_TICKER_COUNT - askSteps - 1]?.[1] || 0
      };

      // 更新位置
      if (bidNextPos.x !== bidsDotDetailGroup.x() || bidNextPos.y !== bidsDotDetailGroup.y()) {
        bidsDotDetailGroup.position(bidNextPos);
        (bidsLine as Konva.Line).points([
          bidNextPos.x, 0, 
          bidNextPos.x, yAxisHeight
        ]);
        (bidsOverlay as Konva.Rect).size({
          width: bidNextPos.x,
          height: yAxisHeight
        });
      }

      if (askNextPos.x !== asksDotDetailGroup.x() || askNextPos.y !== asksDotDetailGroup.y()) {
        asksDotDetailGroup.position(askNextPos);
        (asksOverlay as Konva.Rect).size({
          width: askSteps * stepSize,
          height: yAxisHeight
        });
        (asksOverlay as Konva.Rect).position({
          x: askNextPos.x,
          y: 0
        });
        (asksLine as Konva.Line).points([
          askNextPos.x, 0,
          askNextPos.x, yAxisHeight
        ]);
      }

      // 更新文本内容
      const [_, bidsDetailGroup] = (bidsDotDetailGroup as Konva.Group).getChildren();
      const [__, asksDetailGroup] = (asksDotDetailGroup as Konva.Group).getChildren();
      const bidDetailChildren = (bidsDetailGroup as Konva.Group).getChildren();
      const askDetailChildren = (asksDetailGroup as Konva.Group).getChildren();

      const bidIndex = MAX_TICKER_COUNT - bidSteps - 1;
      if (bidIndex >= 0 && bidIndex < _bidPoints.length) {
        const bidPoint = _bidPoints[bidIndex];
        if (bidPoint?.length >= 4) {
          const bidPriceText = bidDetailChildren[3] as Konva.Text;
          const bidAmountText = bidDetailChildren[4] as Konva.Text;
          if (bidPriceText && bidAmountText) {
            bidPriceText.text(bidPoint[2].toString());
            bidAmountText.text(formatAmount(bidPoint[3]));
          }
        }
      }

      const askIndex = MAX_TICKER_COUNT - askSteps - 1;
      if (askIndex >= 0 && askIndex < _askPoints.length) {
        const askPoint = _askPoints[askIndex];
        if (askPoint?.length >= 4) {
          const askPriceText = askDetailChildren[3] as Konva.Text;
          const askAmountText = askDetailChildren[4] as Konva.Text;
          if (askPriceText && askAmountText) {
            askPriceText.text(askPoint[2].toString());
            askAmountText.text(formatAmount(askPoint[3]));
          }
        }
      }

      // 处理碰撞检测
      const bidDetailRect = bidDetailChildren[0] as Konva.Rect;
      const askDetailRect = askDetailChildren[0] as Konva.Rect;
      const defaultBidDetailX = askNextPos.x + 10;
      const defaultAskDetailX = askNextPos.x - askDetailRect.width() - 10;
      const isCollide = defaultAskDetailX < (defaultBidDetailX + bidDetailRect.width());

      if (isCollide) {
        bidsDetailGroup.position({
          x: -bidDetailRect.width() - 10,
          y: -bidDetailRect.height() / 2
        });
        asksDetailGroup.position({
          x: 10,
          y: -askDetailRect.height() / 2
        });
      } else {
        bidsDetailGroup.position({
          x: 10,
          y: -bidDetailRect.height() / 2
        });
        asksDetailGroup.position({
          x: -askDetailRect.width() - 10,
          y: -askDetailRect.height() / 2
        });
      }

      // 更新数据引用
      const precision = symbolInfo?.quantityPrecision ?? 2;
      tooltipDataRef.current = {
        askPoints: _askPoints,
        bidPoints: _bidPoints,
        quantityPrecision: precision
      };
    } catch (error) {
      console.error('Tooltip update error:', error);
    }
  }, [getXAxisRect, getYAxisRect, getStepSize, getSteps, getPoints]);

  // 隐藏工具提示
  const hideUI = useCallback(() => {
    if (tooltipGroupRef.current) {
      tooltipGroupRef.current.visible(false);
      isMouseOverRef.current = false;
    }
  }, []);

  // 显示工具提示
  const showUI = useCallback(() => {
    if (tooltipGroupRef.current) {
      tooltipGroupRef.current.visible(true);
      isMouseOverRef.current = true;
    }
  }, []);

  // 清除工具提示
  const clearTooltip = useCallback(() => {
    tooltipGroupRef.current = undefined;
    tooltipDataRef.current = undefined;
    isMouseOverRef.current = false;
  }, []);

  return {
    createTooltip,
    updateUI,
    hideUI,
    showUI,
    clearTooltip
  };
}