import {
  ChartingLibraryFeatureset,
  ChartingLibraryWidgetOptions,
  Timezone,
  EntityId,
  EntityInfo,
} from './../../../../../../../public/charting_library'
import { widget } from './../../../../../../../public/charting_library/charting_library.esm'
import AvenirDataFeed from './avenir-data-feed'
import {
  DEFAULT_PERIOD,
  DOWN_COLOR_LIGHT,
  getTransparentColor,
  languageToLocale,
  periodToResolution,
  resolutionToPeriod,
  UP_COLOR_LIGHT,
} from './utils'
import { Period } from './interface'
import Logger from '@/utils/logger'
import { ThemeEnum } from '@/constants/theme-enum'
import { getOverridesByThemeName, upGreenThemes, upRedThemes } from './theme'
import { noop, get } from 'lodash-es'
import { ColorModeEnum } from '@/constants/color-mode-enum'

const disabled_features = [
  'header_widget',
  'compare_symbol',
  'symbol_search_hot_key',
  'display_market_status',
  'go_to_date',
  'header_chart_type',
  'header_compare',
  'header_interval_dialog_button',
  'header_resolutions',
  'header_screenshot',
  'header_symbol_search',
  'header_undo_redo',
  'legend_context_menu',
  'show_hide_button_in_legend',
  'show_interval_dialog_on_key_press',
  'snapshot_trading_drawings',
  'symbol_info',
  'timeframes_toolbar',
  'volume_force_overlay',
  'use_localstorage_for_settings',
  'study_templates',
  'popup_hints',
  'show_symbol_logos',
  'edit_butions_in_legend',
  'main_series_scale_menu',
] as ChartingLibraryFeatureset[]

const enabled_features = [
  'dont_show_boolean_study_arguments',
  'hide_last_na_study_output',
  'move_logo_to_main_pane',
  'same_data_requery',
  'side_toolbar_in_fullscreen_mode',
  'keep_left_toolbar_visible_on_small_screens',
  'disable_resolution_rebuild',
] as ChartingLibraryFeatureset[]

export interface AvenirWidgetOptions {
  tabid: string
  container: HTMLDivElement
  symbol: string
  period?: Period
  timezone?: string
  language?: string
  libraryPath?: string
  colorMode: ColorModeEnum
  theme: ThemeEnum
  customCssUrl?: string
  onChartReady?: () => void
}

class AvenirWidget extends widget {
  private symbol: string
  defaultMAStudies?: Array<EntityId | null>
  logger: Logger
  colorMode: ColorModeEnum
  theme: ThemeEnum

  constructor(options: AvenirWidgetOptions) {
    const {
      container,
      symbol,
      period = DEFAULT_PERIOD,
      timezone = 'exchange',
      language = 'zh-cn',
      libraryPath = '/static/charting_library/',
      customCssUrl = '/static/charting_library/custom.css',
      colorMode,
      theme,
      tabid,
    } = options

    const datafeed = new AvenirDataFeed(timezone, tabid)
    const defaultTheme =
      colorMode === ColorModeEnum.GREEN_UP_RED_DOWN
        ? upGreenThemes
        : upRedThemes
    const tvTheme = getOverridesByThemeName(defaultTheme, theme)

    const defaultOptions: ChartingLibraryWidgetOptions = {
      container,
      library_path: libraryPath,
      locale: languageToLocale(language),
      disabled_features,
      enabled_features,
      client_id: 'avenir.trade',
      user_id: 'public_user',
      fullscreen: false,
      autosize: true,
      timezone: timezone as Timezone,
      datafeed,
      debug: false,
      load_last_chart: true,
      overrides: tvTheme?.overrides,
      studies_overrides: tvTheme?.studiesOverrides,
      custom_font_family: 'IBM Plex Sans',
      custom_css_url: customCssUrl,
    }

    super(defaultOptions)
    this.colorMode = colorMode
    this.theme = theme
    this.symbol = symbol
    this.logger = new Logger({
      debug: true,
      topic: 'AvenirWidget',
      tags: [tabid],
    })

    this.onChartReady(() => {
      this.logger.i('AvenirWidget onChartReady start')
      options.onChartReady?.()
    })
  }
  reload(options: { symbol: string; period: Period; timezone?: string }) {
    const { symbol, period, timezone } = options
    const symbolChanged = this.symbol !== symbol
    const timezoneChanged = this._getTimezone() !== timezone
    const periodChanged = this._getPeriod() !== period

    // 处理交易对变更
    if (symbolChanged) {
      this.symbol = symbol
      // 获取当前分辨率
      const resolution = this.symbolInterval().interval
      // 设置新交易对
      this.setSymbol(symbol, resolution, () => {
        this.logger.i('交易对切换完成', { symbol })
      })
    }

    // 处理周期变更
    if (periodChanged) {
      this.activeChart()?.setResolution(periodToResolution(period), () => {
        this.logger.i('周期切换完成', { period })
      })
    }

    // 处理时区变更
    if (timezoneChanged && timezone) {
      try {
        this.chart()
          ?.getTimezoneApi()
          .setTimezone(timezone as Timezone)
        this.logger.i('时区切换完成', { timezone })
      } catch (error) {
        this.logger.w('设置时区错误', error)
      }
    }

    // 所有变更完成后刷新成交量指标
    if (symbolChanged || periodChanged) {
      this._setVolumeInputValues()
    }
  }

  /** 设置成交量指标参数 */
  _setVolumeInputValues = async () => {
    const allChartVolumeStudies =
      this.activeChart()
        ?.getAllStudies()
        ?.filter((it: EntityInfo) => it.name === 'Volume') || []

    allChartVolumeStudies.forEach((study: EntityInfo) => {
      const studyById = this.activeChart()?.getStudyById(study.id)
      studyById?.setInputValues([{ id: 'col_prev_close', value: true }])

      const { upColor, downColor } = this._getUpDownColor()
      studyById?.applyOverrides({
        'volume.color.0': getTransparentColor(downColor),
        'volume.color.1': getTransparentColor(upColor),
      })
    })
  }

  /** 获取当前时区 */
  _getTimezone = () => {
    return this.chart()?.getTimezoneApi().getTimezone().id
  }

  /** 获取主题相关参数 */
  _getThemeParams = (theme?: ThemeEnum, colorMode?: ColorModeEnum) => {
    const _colorMode = colorMode || this.colorMode
    const _theme = theme || this.theme
    const baseThemes =
      _colorMode === ColorModeEnum.RED_UP_GREEN_DOWN
        ? upRedThemes
        : upGreenThemes
    return getOverridesByThemeName(baseThemes, _theme)
  }

  /** 获取当前周期 */
  _getPeriod = () => {
    return resolutionToPeriod(this.symbolInterval().interval)
  }

  /** 获取涨跌颜色 */
  getUpDownColor = (theme?: ThemeEnum, colorMode?: ColorModeEnum) => {
    const tvTheme = this._getThemeParams(theme, colorMode)
    if (!tvTheme) {
      return {
        upColor: UP_COLOR_LIGHT,
        downColor: DOWN_COLOR_LIGHT,
      }
    }

    const { overrides } = tvTheme
    return {
      upColor: get(
        overrides,
        'mainSeriesProperties.candleStyle.upColor',
        ''
      ) as string,
      downColor: get(
        overrides,
        'mainSeriesProperties.candleStyle.downColor',
        ''
      ) as string,
    }
  }

  /** 重设主题 */
  resetTheme(theme: ThemeEnum, colorMode: ColorModeEnum, callback = noop) {
    this.logger.i('重设主题', { theme, colorMode })
    const tvTheme = this._getThemeParams(theme, colorMode)
    if (!tvTheme) return

    this.colorMode = colorMode
    this.theme = theme

    this.changeTheme(tvTheme.theme).then(() => {
      if (tvTheme.overrides) {
        this.applyOverrides(tvTheme.overrides)
      }
      if (tvTheme.studiesOverrides) {
        this.applyStudiesOverrides(tvTheme.studiesOverrides)
      }
      this.logger.i('切换主题成功', { tvTheme, theme, colorMode })
      callback()
    })
  }
}

export default AvenirWidget
