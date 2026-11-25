/** U5 预览器专用 Tailwind 配置：扫描范围与 App 相同（src/），再加上预览器自己。 */
export default {
  content: ['./src/**/*.{ts,tsx}', './tools/preview/u5/**/*.tsx'],
  theme: { extend: {} },
  plugins: [],
};
