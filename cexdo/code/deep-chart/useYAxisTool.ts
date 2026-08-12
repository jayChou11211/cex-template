import { useCallback } from 'react';
import Konva from 'konva';
import { axisSize } from '/axis-size';
import { xLabelsHeight } from '/x-label-height';
import { yLabelsWidth } from '/y-label-width';

export function useYAxisTool() {
  const getYAxisRect = useCallback(
    (stage: Konva.Stage) => ({
      width: yLabelsWidth + axisSize,
      height: stage.height() - xLabelsHeight - axisSize,
    }),
    []
  );

  return {
    getYAxisRect,
  };
}