// theme.ts
import { Overrides, StudyOverrides, ThemeName } from '../../../../../../../../../../public/charting_library';
import { ThemeEnum } from '@/utils/set-theme';
import { DOWN_COLOR_LIGHT, DOWN_COLOR_DARK, UP_COLOR_LIGHT, UP_COLOR_DARK } from '@/constants';

const BASE_COLORS = {
  LIGHT: {
    BG: 'rgba(255, 255, 255, 1)',
    GRID: 'rgba(255, 255, 255, 1)',
    CROSS: 'rgba(137, 140, 147, 1)',
    BORDER: 'rgba(241, 243, 247, 1)',
    TEXT: 'rgba(68, 71, 78, 1)',
    LINE: 'rgba(241, 243, 247, 1)'
  },
  DARK: {
    BG: 'rgba(19, 19, 28, 1)',
    GRID: 'rgba(19, 19, 28, 1)',
    CROSS: 'rgba(129, 129, 146, 1)',
    BORDER: 'rgba(220, 212, 255, 0.04)',
    TEXT: 'rgba(173, 173, 191, 1)',
    LINE: 'rgba(220, 212, 255, 0.04)'
  }
} as const;

// 基础主题参数接口
export interface ITThemeParams {
  up: string;   // 上涨颜色
  down: string; // 下跌颜色
  bg: string;   // 背景颜色
  grid: string; // 网格颜色
  cross: string;// 十字线颜色
  border: string;// 边框颜色
  text: string; // 文本颜色
  line: string; // 线条颜色
  name: ThemeName; // 主题名称
}

// TradingView 主题参数接口
export interface ITVTThemeParams {
  overrides: Overrides;
  studiesOverrides: Partial<StudyOverrides>;
  theme: ThemeName;
}

export type DefaultTheme = Record<'light' | 'dark', ITThemeParams>;
export type TVTheme = Record<keyof DefaultTheme, ITVTThemeParams>;

// K线样式配置
const candleStyle = {
  upColor: UP_COLOR_LIGHT,
  downColor: DOWN_COLOR_LIGHT,
  borderUpColor: UP_COLOR_LIGHT,
  borderDownColor: DOWN_COLOR_LIGHT,
  wickUpColor: UP_COLOR_LIGHT,
  wickDownColor: DOWN_COLOR_LIGHT
};

// 生成半透明颜色
const getTransparentColor = (color: string, opacity = 0.3) => {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// 生成TradingView主题配置
export function generateTheme(theme: ITThemeParams): ITVTThemeParams {
  const mainProperties = {
    'volumePaneSize': 'medium',
    'scalesProperties.lineColor': theme.line,
    'scalesProperties.textColor': theme.text,
    'paneProperties.background': theme.bg,
    'paneProperties.backgroundGradientStartColor': theme.bg,
    'paneProperties.backgroundGradientEndColor': theme.bg,
    'paneProperties.vertGridProperties.color': theme.grid,
    'paneProperties.horzGridProperties.color': theme.grid,
    'paneProperties.crossHairProperties.color': theme.cross,
    'paneProperties.legendProperties.showStudyArguments': true,
    'paneProperties.legendProperties.showStudyTitles': true,
    'paneProperties.legendProperties.showStudyValues': true,
    'paneProperties.legendProperties.showSeriesTitle': true
  };

  // 生成K线样式配置
  const candleStyleProperties = Object.entries(candleStyle).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [`mainSeriesProperties.candleStyle.${key}`]: value
    }), 
    {}
  );

  return {
    overrides: {
      ...mainProperties,
      ...candleStyleProperties,
      'mainSeriesProperties.haStyle.barColorOnPrevClose': true
    },
    studiesOverrides: {
      'volume.volume.color.0': getTransparentColor(theme.down),
      'volume.volume.color.1': getTransparentColor(theme.up)
    },
    theme: theme.name
  };
}

// 根据主题名称获取配置
export function getOverridesByThemeName(
  theme: DefaultTheme, 
  themeName: ThemeEnum
): ITVTThemeParams | undefined {
  const key = themeName === ThemeEnum.Light ? 'light' : 'dark';
  return theme[key] ? generateTheme(theme[key]) : undefined;
}