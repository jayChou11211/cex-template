import { useCallback } from 'react';
import Konva from 'konva';
import { axisSize } from '/axis-size';
import { xLabelsHeight } from '/x-label-height';
import { yLabelsWidth } from '/y-label-width';

export function useXAxisTool() {
  const getXAxisRect = useCallback(
    (stage: Konva.Stage) => ({
      width: stage.width() - yLabelsWidth - axisSize,
      height: xLabelsHeight + axisSize,
    }),
    []
  );

  return {
    getXAxisRect,
  };
}