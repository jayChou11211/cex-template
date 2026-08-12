import {
  Bar,
  DataFeedErrorCallback,
  HistoryCallback,
  IBasicDataFeed,
  LibrarySymbolInfo,
  OnReadyCallback,
  PeriodParams,
  ResolutionString,
  ResolveCallback,
  SubscribeBarsCallback,
} from './../../../../../../../public/charting_library';
import { BusinessTypeEnum } from '@/constants/business-type-enum';
import { createStreamPath, marketWebSocket } from '@/utils/web-socket';
import { KlineRealTimeItem } from './interface';
import {
  klineRealTimeItemToBar,
  klineSnapshotItemToBar,
  MAX_PRICE_DECIMALS,
  parseSymbolForTradingView,
  resolutionToPeriod,
} from './utils';
import Logger from '@/utils/logger';
import { MarketService } from '@/services/market-service';
import { useSymbolStore } from '@/stores/trade/symbol-store';
import { formatSymbol } from '@/utils/format-symbol';

type DataFeedSymbolInfo = LibrarySymbolInfo & {
  businessType: BusinessTypeEnum;
  symbol: string;
};

class AvenirDataFeed implements IBasicDataFeed {
  timezone: string;
  private static unsubscribeMessageFnMap = new Map<string, VoidFunction>();
  private static unsubscribeStreamFnMap = new Map<string, VoidFunction>();
  logger: Logger;
  tabId: string;

  constructor(timezone: string, tabId: string) {
    this.timezone = timezone;
    this.tabId = tabId;
    this.logger = new Logger({
      debug: true,
      topic: 'AvenirDataFeed',
      tags: [tabId],
    });
  }

  searchSymbols(): void {
    throw new Error("Method not implemented.");
  }

  onReady(callback: OnReadyCallback): void {
    setTimeout(() => {
      callback({});
    }, 0);
  }

  resolveSymbol(
    symbolName: string,
    onResolve: ResolveCallback,
    onError: DataFeedErrorCallback,
  ): void {
    const { symbol, businessType } = parseSymbolForTradingView(symbolName);
    const symbolInfo = useSymbolStore.getState().findSymbol(businessType, symbol);
    
    if (!symbolInfo) {
      onError('Symbol not found');
      return;
    }

    const baseSymbolInfo = {
      format: 'price',
      session: '24x7',
      timezone: this.timezone,
      exchange: 'XCoin',
      listed_exchange: 'XCoin',
      type: 'bitcoin',
      minmov: 1,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
    };

    const { pricePrecision, quantityPrecision } = symbolInfo;
    const formattedSymbol = formatSymbol(businessType, symbol);

    const finalSymbolInfo = {
      ...baseSymbolInfo,
      name: formattedSymbol,
      ticker: formattedSymbol,
      full_name: formattedSymbol,
      description: '',
      pricescale: Number(`1e${Math.min(Number(pricePrecision), MAX_PRICE_DECIMALS)}`),
      volume_precision: Number(quantityPrecision),
      businessType,
      symbol,
    };

    setTimeout(() => {
      onResolve(finalSymbolInfo as LibrarySymbolInfo);
    }, 0);
  }

  async getBars(
    symbolInfo: DataFeedSymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: DataFeedErrorCallback,
  ): Promise<void> {
    const { from, to } = periodParams;
    const period = resolutionToPeriod(resolution);
    const { businessType, symbol } = symbolInfo;
    const params = {
      businessType,
      symbol,
      period: period.toLowerCase(),
      startTime: (from * 1000).toString(),
      endTime: (to * 1000).toString(),
    };

    try {
      const historyKline = await MarketService.getHistoryKline(params);
      if (historyKline.length === 0) {
        onResult([], { noData: true });
        return;
      }

      const bars = historyKline
        .map((item: string[]) => klineSnapshotItemToBar(item))
        .sort((a: Bar, b: Bar) => a.time - b.time);
      onResult(bars);
    } catch (error) {
      console.log(error);
      onError('Failed to fetch data');
    }
  }

  subscribeBars(
    symbolInfo: DataFeedSymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string,
  ): void {
    this.logger.i('subscribeBars', { symbolInfo, resolution, onTick, listenerGuid });
    const interval = resolutionToPeriod(resolution);
    const { businessType, symbol } = symbolInfo;
    const params = {
      businessType,
      symbol,
      stream: `kline#${interval.toLowerCase()}`,
    };

    const unsubscribeMessageFn = marketWebSocket.sendSubscribeMessage([params]);
    const handleStreamData = (payload: KlineRealTimeItem[]) => {
      if (payload.length === 0) {
        return;
      }
      const bar = payload[0];
      onTick(klineRealTimeItemToBar(bar));
    };

    marketWebSocket.on(
      this._createSubscribeStreamPath(params.businessType, params.symbol, params.stream),
      handleStreamData,
    );

    const unsubscribeStream = () => {
      marketWebSocket.off(
        this._createSubscribeStreamPath(params.businessType, params.symbol, params.stream),
        handleStreamData,
      );
    };

    const subUUID = this._getSubUUID({ listenerGuid, tabId: this.tabId });
    AvenirDataFeed.unsubscribeMessageFnMap.set(subUUID, unsubscribeMessageFn);
    AvenirDataFeed.unsubscribeStreamFnMap.set(subUUID, unsubscribeStream);
  }

  unsubscribeBars(listenerGuid: string): void {
    const subUUID = this._getSubUUID({ listenerGuid, tabId: this.tabId });
    this.logger.i('unsubscribeBars', listenerGuid, AvenirDataFeed.unsubscribeMessageFnMap.get(subUUID));
    AvenirDataFeed.unsubscribeMessageFnMap.get(subUUID)?.();
    AvenirDataFeed.unsubscribeStreamFnMap.get(subUUID)?.();
    AvenirDataFeed.unsubscribeMessageFnMap.delete(subUUID);
    AvenirDataFeed.unsubscribeStreamFnMap.delete(subUUID);
  }

  private _getSubUUID(params: { listenerGuid: string; tabId: string }) {
    return `${params.listenerGuid}-${params.tabId}`;
  }

  private _createSubscribeStreamPath(businessType: BusinessTypeEnum, symbol: string, stream: string) {
    return createStreamPath({ businessType, symbol, stream });
  }
}

export default AvenirDataFeed;