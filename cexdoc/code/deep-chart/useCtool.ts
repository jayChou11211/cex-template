import Konva from 'konva';
import { useCallback } from 'react';
import { useYAxisTool } from './useYAxisTool';
import { useXAxisTool } from './useXAxisTool';
import { axisSize } from './axis-size';

// 买卖深度图之间的间隔
const axisBidsSpread = 2;

export function useCTool() {
  const { getYAxisRect } = useYAxisTool();
  const { getXAxisRect } = useXAxisTool();

  /**
   * 获取主内容区域矩形
   * @param stage Konva Stage 对象
   * @returns 主内容区域矩形 { w: 宽度, h: 高度 }
   */
  const getCRect = useCallback((stage: Konva.Stage) => {
    const { w: yAxisWidth } = getYAxisRect(stage);
    const { h: xAxisHeight } = getXAxisRect(stage);
    
    return {
      w: stage.width() - yAxisWidth,
      h: stage.height() - xAxisHeight
    };
  }, [getXAxisRect, getYAxisRect]);

  /**
   * 获取买盘深度区域矩形
   * @param stage Konva Stage 对象
   * @returns 买盘深度区域矩形 { w: 宽度, h: 高度, x: X坐标, y: Y坐标 }
   */
  const getBidsRect = useCallback((stage: Konva.Stage) => {
    const { w: yAxisWidth } = getYAxisRect(stage);
    const { h: xAxisHeight } = getXAxisRect(stage);
    
    const w = (stage.width() - yAxisWidth - axisSize) / 2 - axisSize / 2;
    const h = stage.height() - xAxisHeight;
    
    return {
      w: w - axisBidsSpread,
      h,
      x: 0,
      y: 0
    };
  }, [getYAxisRect, getXAxisRect]);

  /**
   * 获取卖盘深度区域矩形
   * @param stage Konva Stage 对象
   * @returns 卖盘深度区域矩形 { w: 宽度, h: 高度, x: X坐标, y: Y坐标 }
   */
  const getAsksRect = useCallback((stage: Konva.Stage) => {
    const { w: yAxisWidth } = getYAxisRect(stage);
    const { h: xAxisHeight } = getXAxisRect(stage);
    
    const w = (stage.width() - yAxisWidth - axisSize) / 2 - axisSize / 2;
    const h = stage.height() - xAxisHeight;
    
    return {
      w: w - axisBidsSpread,
      h,
      x: w + axisSize + axisBidsSpread,
      y: 0
    };
  }, [getYAxisRect, getXAxisRect]);

  return {
    getCRect,      // 获取主内容区域矩形
    getBidsRect,   // 获取买盘深度区域矩形
    getAsksRect    // 获取卖盘深度区域矩形
  };
}