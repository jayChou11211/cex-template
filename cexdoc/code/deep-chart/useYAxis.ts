import Konva from 'konva';
import { useCallback } from 'react';
import { getCSSVariable } from '/get-css-variable';
import { axisSize } from '/axis-size';
import { yLabelsSpace } from '/y-labels-space';
import { useVAxisTool } from '/useVAxisTool';
import { useCTool } from '/useCTool';

export function useVAxis() {
  const { getVAxisRect } = useVAxisTool();
  const { getCRect } = useCTool();

  const updateVAxisDivider = useCallback(
    (stage: Konva.Stage, layer: Konva.Layer) => {
      const { height: vAxisHeight } = getVAxisRect(stage);
      const { width: cWidth } = getCRect(stage);

      layer.add(
        new Konva.Line({
          stroke: getCSSVariable('--an-ui-c_102_n'),
          strokeWidth: axisSize,
          points: [cWidth, 0, cWidth, vAxisHeight],
        })
      );
    },
    [getVAxisRect, getCRect]
  );

  const updateVAxisLabels = useCallback(
    (stage: Konva.Stage, layer: Konva.Layer, yLabels: [number, string][]) => {
      const { width: cWidth, height: cHeight } = getCRect(stage);
      
      const yLabelsStyles = {
        fontSize: 12,
        fontFamily: 'IBM Plex Sans',
        fill: getCSSVariable('--an-ui-c_102_n'),
        height: 16,
        align: 'center',
        verticalAlign: 'middle',
      };

      // 跳过第一个标签（索引0），从索引1开始
      yLabels.slice(1).forEach((scale, index) => {
        const formattedText = scale[1];
        
        layer.add(
          new Konva.Text({
            ...yLabelsStyles,
            x: cWidth + axisSize + yLabelsSpace,
            y: cHeight - (cHeight / 6) * (index + 1) - 16 / 2,
            text: formattedText,
          })
        );
      });
    },
    [getCRect]
  );

  return {
    updateVAxisDivider,
    updateVAxisLabels,
  };
}