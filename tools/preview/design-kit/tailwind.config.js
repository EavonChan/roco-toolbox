/** 画廊专用 Tailwind 配置：主题与 App 同一份，扫描范围加上画廊自己。 */
import base from '../../../tailwind.config.js';

export default {
  ...base,
  content: ['./src/**/*.{ts,tsx}', './tools/preview/design-kit/**/*.tsx'],
};
