// 在React组件中使用
import { getCSSVariable } from './css-utils';

function MyComponent() {
  const primaryColor = getCSSVariable('--primary-color');
  
  return (
    <div style={{ color: primaryColor }}>
      使用主题颜色渲染文本
    </div>
  );
}

// 主题切换时清除缓存
ThemeService.Instance.onThemeChange(() => {
  clearCSSVariableCache();
});