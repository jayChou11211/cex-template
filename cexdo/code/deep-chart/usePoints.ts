import toBN from '@juliafgo-bn';
import { useCallback } from 'react';
import { useCTool } from 'JaseCTool';
import Konva from 'konva';
import { DepthChart } from '@jinterfaces/stores/trade/depth-char-store';
import { useXAidTool } from 'JaseXAidTool';
import { MAX_TICKER_COUNT } from 'Jconstants';

export function usePoints() {
  const { getXAidRect } = useXAidTool();
  const { getAsksRect, getBidsRect } = useCTool();

  const getStepSize = useCallback(
    (stage: Konva.Stage) => {
      const { x: bidsX } = getBidsRect(stage);
      return bidsX / (MAX_TICKER_COUNT - 1);
    },
    [getBidsRect]
  );

  const getSteps = useCallback(
    (stage: Konva.Stage, pos: { x: number; y: number }) => {
      const { width: xAxisWidth } = getXAidRect(stage);
      const { width: bidsWidth, x: bidsX } = getBidsRect(stage);
      const { x: axisX } = getXAidRect(stage);
      const stepSize = getStepSize(stage);

      return Math.min(
        Math.max(
          (pos.x >= bidsX && pos.x < bidsWidth) || 
          (pos.x > bidsWidth && pos.x < axisX)
            ? bidsX
            : pos.x <= bidsX
              ? pos.x
              : xAxisWidth - pos.x,
          0
        ) / stepSize,
        MAX_TICKER_COUNT - 1
      );
    },
    [getXAidRect, getStepSize, getBidsRect]
  );

  const getPoints = useCallback(
    (stage: Konva.Stage, asks: DepthChart[], bids: DepthChart[]) => {
      const { y: bidsY } = getBidsRect(stage);
      const { x: asksX } = getAsksRect(stage);
      const stepSize = getStepSize(stage);

      return {
        bidPoints: bids.map(({ price, amount, step, amountPrecision }) => ({
          x: stepSize * Number(step),
          y: toBN(bidsY).multipliedBy(amountPrecision).toNumber(),
          price,
          amount,
        })),
        askPoints: asks.map(({ price, amount, step, amountPrecision }) => ({
          x: asksX + stepSize * Number(step),
          y: toBN(bidsY).multipliedBy(amountPrecision).toNumber(),
          price,
          amount,
        })),
      };
    },
    [getBidsRect, getAsksRect, getStepSize]
  );

  return {
    getStepSize,
    getPoints,
    getSteps,
  };
}