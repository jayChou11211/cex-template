import Konva from 'konva';
import { useCallback, useEffect, useRef } from 'react';
import { getCSSVariable } from '/get-css-variable';
import { axisSize } from '/axis-size';
import { useCTool } from '/useCTool';
import { useXAidTool } from 'JaseXAidTool';

// 定义常量
const LABEL_SPACING = 10;
const X_LABEL_HEIGHT = 20;

export function useXAxis() {
  const { getAsksRect, getBidsRect } = useCTool();
  const { getXAidRect, getXAxisRect, getYAxisRect } = useXAidTool();
  
  // 用于存储X轴组件的引用
  const xAxisGroupRef = useRef<{
    group: Konva.Group | null;
    tempText: Konva.Text | null;
  }>({ group: null, tempText: null });

  // 清理函数
  useEffect(() => {
    return () => {
      xAxisGroupRef.current.tempText?.destroy();
      xAxisGroupRef.current.group?.destroy();
      xAxisGroupRef.current = { group: null, tempText: null };
    };
  }, []);

  // 创建标签样式
  const createLabelStyles = (isMidPrice = false) => ({
    fontFamily: 'IBM Flex Sans',
    fill: getCSSVariable('--an-ui-c_102_n'),
    ...(isMidPrice && { fontWeight: 'bold' }),
  });

  // 创建X轴组
  const createXAxisGroup = (layer: Konva.Layer) => {
    const group = new Konva.Group();
    layer.add(group);
    xAxisGroupRef.current.group = group;
    
    // 创建临时文本用于测量
    const tempText = new Konva.Text({
      text: '',
      fontSize: 12,
      fontFamily: 'IBM Flex Sans',
    });
    xAxisGroupRef.current.tempText = tempText;
    group.add(tempText);
  };

  // 更新X轴标签
  const updateXAxisLabels = useCallback(
    (
      stage: Konva.Stage,
      layer: Konva.Layer,
      [bidPoints, askPoints]: [number[][], number[][]],
      realMidPrice?: string
    ) => {
      // 确保X轴组存在
      if (!xAxisGroupRef.current.group?.parent) {
        createXAxisGroup(layer);
      }

      const { height: asksHeight, x: asksX } = getAsksRect(stage);
      const { height: axisHeight } = getXAidRect(stage);
      
      // 清空现有标签
      xAxisGroupRef.current.group?.destroyChildren();
      const labelPositions: { x: number; width: number }[] = [];

      // 检查标签是否重叠
      const isOverlapping = (x: number, width: number) => {
        return labelPositions.some(
          pos => Math.abs(pos.x - x) < (pos.width + width) / 2 + LABEL_SPACING
        );
      };

      // 创建标签函数
      const createLabel = (
        x: number,
        price: string | number,
        options: {
          isMidPrice?: boolean;
          showLabel?: boolean;
          showTick?: boolean;
        } = {}
      ) => {
        const { isMidPrice = false, showLabel = true, showTick = true } = options;
        const text = price.toString();
        const styles = createLabelStyles(isMidPrice);

        // 使用临时文本测量宽度
        xAxisGroupRef.current.tempText?.setAttrs({ ...styles, text });
        const labelWidth = xAxisGroupRef.current.tempText?.width() || 0;

        // 创建标签
        const label = new Konva.Text({
          x: x - labelWidth / 2,
          y: axisHeight + axisSize + (X_LABEL_HEIGHT - (styles.fontSize || 12)) / 2,
          text,
          ...styles,
          visible: showLabel,
        });

        // 创建刻度线
        const tick = new Konva.Line({
          stroke: getCSSVariable('--an-ui-c_102_n'),
          strokeWidth: 1,
          points: [x, axisHeight, x, axisHeight + 4],
          visible: showTick,
        });

        // 添加到组
        xAxisGroupRef.current.group?.add(label, tick);
        return { x, width: labelWidth, label, tick };
      };

      // 添加中间价格标签
      if (realMidPrice) {
        const midX = asksX;
        const result = createLabel(midX, realMidPrice, {
          isMidPrice: true,
          showLabel: true,
          showTick: false,
        });
        labelPositions.push({ x: result.x, width: result.width });
      }

      // 确定主导点（数量更多的一侧）
      const isBidMore = bidPoints.length > askPoints.length;
      const dominantPoints = isBidMore ? bidPoints : askPoints;
      const otherPoints = isBidMore ? askPoints : bidPoints;

      // 处理主导点
      dominantPoints.forEach((point, i) => {
        const [x, price] = point;
        const dominantLabel = createLabel(x, price);
        const otherPoint = otherPoints[i];

        // 如果有对应的另一侧点
        if (otherPoint) {
          const [otherX, otherPrice] = otherPoint;
          const otherLabel = createLabel(otherX, otherPrice, {
            showTick: !isBidMore && i === 0, // 只在第一个卖点时显示刻度
          });

          // 检查重叠
          if (
            !isOverlapping(dominantLabel.x, dominantLabel.width) &&
            !isOverlapping(otherLabel.x, otherLabel.width)
          ) {
            labelPositions.push(
              { x: dominantLabel.x, width: dominantLabel.width },
              { x: otherLabel.x, width: otherLabel.width }
            );
          } else {
            // 移除重叠标签
            dominantLabel.label.destroy();
            dominantLabel.tick.destroy();
            otherLabel.label.destroy();
            otherLabel.tick.destroy();
          }
        } else {
          // 没有对应点的情况
          if (!isOverlapping(dominantLabel.x, dominantLabel.width)) {
            labelPositions.push({ x: dominantLabel.x, width: dominantLabel.width });
          } else {
            dominantLabel.label.destroy();
            dominantLabel.tick.destroy();
          }
        }
      });

      // 重绘
      xAxisGroupRef.current.group?.draw();
      layer.batchDraw();
    },
    [getAsksRect, getXAidRect]
  );

  // 更新X轴分隔线
  const updateXAxisDivider = useCallback(
    (stage: Konva.Stage, layer: Konva.Layer) => {
      const { height: yAxisHeight } = getYAxisRect(stage);
      const { width: xAxisWidth } = getXAxisRect(stage);

      layer.add(
        new Konva.Line({
          stroke: getCSSVariable('--an-ui-c_s02_n'),
          strokeWidth: axisSize,
          points: [0, yAxisHeight, xAxisWidth, yAxisHeight],
        })
      );
    },
    [getYAxisRect, getXAxisRect]
  );

  return {
    updateXAxisDivider,
    updateXAxisLabels,
  };
}