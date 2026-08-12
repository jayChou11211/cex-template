import { BusinessTypeEnum } from '@constants/business-type-enum';
import { Bar, LanguageCode, ResolutionString } from '../../../../../../../public/charting_library';
import { KlineRealTimeItem, Period } from './interface';

// 颜色常量
export const UP_COLOR_DARK = 'rgba(9, 180, 116, 1)';
export const UP_COLOR_LIGHT = 'rgba(5, 132, 78, 1)';
export const DOWN_COLOR_LIGHT = 'rgba(212, 47, 68, 1)';
export const DOWN_COLOR_DARK = 'rgba(231, 59, 81, 1)';

// 其他常量
export const MAX_PRICE_DECIMALS = 6;
export const DEFAULT_PERIOD = '90m';

// 支持的平台周期
export const SUPPORTED_PERIODS = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'] as Period[];

// 支持的 TradingView 周期
export const SUPPORTED_RESOLUTIONS = SUPPORTED_PERIODS.map(periodToResolution);

/**
 * 将 TradingView 的 ResolutionString 转换为平台的 period
 * @param resolution TradingView 时间周期字符串
 * @returns 平台周期字符串
 */
export function resolutionToPeriod(resolution: ResolutionString): string {
  const map: Record<string, string> = {
    '1': '1m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1H',
    '240': '4H',
    '1D': '1D',
    '1W': '1W'
  };
  return map[resolution] || '1D';
}

/**
 * 将平台的 period 转换为 TradingView 的 ResolutionString
 * @param period 平台周期字符串
 * @returns TradingView 时间周期字符串
 */
export function periodToResolution(period: string): ResolutionString {
  const map: Record<string, string> = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1H': '60',
    '4H': '240',
    '1D': '1D',
    '1W': '1W'
  };
  return map[period] as ResolutionString;
}

/**
 * 将语言标识转换为 TradingView 的区域代码
 * @param language 语言标识
 * @returns TradingView 区域代码
 */
export const languageToLocale = (language?: string): LanguageCode => {
  const localeMap: Record<string, LanguageCode> = {
    'zh-cn': 'zh',
    'zh-hk': 'zh_TW',
    'zh-tc': 'zh_TW',
    'en-us': 'en',
    'ru-ru': 'ru',
    'ko-kr': 'ko',
    'pt-pt': 'pt',
    'tr-tr': 'tr',
    'vi-vn': 'vi',
    'es-es': 'es',
    'es-lat': 'en',
    'fr-fr': 'fr',
    'de-de': 'de',
    'id-id': 'id_ID',
    'it-it': 'it',
    'ms-my': 'ms_MY',
    'en-in': 'en',
    'pt-br': 'en',
    'hi-in': 'en',
    'uk-ua': 'en',
  };

  if (!language) {
    return 'en';
  }

  // 处理可能的格式问题
  if (language.includes('_')) {
    language = language.replace('_', '-');
  }

  return localeMap[language.toLowerCase()] || 'en';
};

/**
 * 将快照K线数据项转换为TradingView的Bar格式
 * @param item K线数据项
 * @returns TradingView Bar对象
 */
export const klineSnapshotItemToBar = (item: string[]): Bar => {
  return {
    time: Number(item[1]) / 1000, // 转换为秒级时间戳
    open: parseFloat(item[3]),
    high: parseFloat(item[5]),
    low: parseFloat(item[6]),
    close: parseFloat(item[4]),
    volume: parseFloat(item[7]),
  };
};

/**
 * 将实时K线数据项转换为TradingView的Bar格式
 * @param item 实时K线数据项
 * @returns TradingView Bar对象
 */
export const klineRealTimeItemToBar = (item: KlineRealTimeItem): Bar => {
  return {
    time: Number(item.openTime) / 1000, // 转换为秒级时间戳
    open: parseFloat(item.openPrice),
    high: parseFloat(item.highPrice),
    low: parseFloat(item.lowPrice),
    close: parseFloat(item.closePrice),
    volume: parseFloat(item.volume),
  };
};

/**
 * 格式化交易对名称用于TradingView
 * @param symbol 交易对
 * @param businessType 业务类型
 * @returns 格式化后的交易对名称
 */
export const formatSymbolForTradingView = (
  symbol: string, 
  businessType: BusinessTypeEnum
): string => {
  return `${symbol}--${businessType}`;
};

/**
 * 解析TradingView格式的交易对名称
 * @param name TradingView格式的交易对名称
 * @returns 解析后的交易对和业务类型
 */
export const parseSymbolForTradingView = (
  name: string
): { symbol: string; businessType: BusinessTypeEnum } => {
  const [symbol, businessType] = name.split('--');
  return { 
    symbol, 
    businessType: businessType as BusinessTypeEnum 
  };
};

/**
 * 获取带透明度的颜色值
 * @param color 原始颜色值 (rgba格式)
 * @param transparency 透明度 (0-1)
 * @returns 带透明度的颜色值
 */
export const getTransparentColor = (
  color: string, 
  transparency = 0.8
): string => {
  return color.replace('1)', `${transparency})`);
};

/**
 * 替代方法：HEX转RGBA带透明度
 * @param hex HEX颜色值
 * @param opacity 透明度 (0-1)
 * @returns RGBA颜色值
 */
export const hexToRgba = (hex: string, opacity = 1): string => {
  let r = 0, g = 0, b = 0;
  
  // 处理3位HEX
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } 
  // 处理6位HEX
  else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
  }
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};