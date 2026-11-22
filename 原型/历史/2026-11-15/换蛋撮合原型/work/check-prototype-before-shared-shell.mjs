import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = ['editor/index.html', 'outputs/index.html'].map((file) => path.join(root, file));
const forbidden = ['在哪见', '几点', '谁先给', '约好时间一起上线'];

const failures = [];
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const label = path.relative(root, file);
  const expect = (condition, message) => {
    if (!condition) failures.push(`${label}: ${message}`);
  };

  expect(/width\s*:\s*min\(/.test(html) || /min-width\s*:\s*0/.test(html), '缺少随屏宽收缩的容器规则');
  expect(/two-col|grid-template-columns\s*:\s*repeat\(2/.test(html), '缺少两列主卡布局');
  expect(/three-col|grid-template-columns\s*:\s*repeat\(3/.test(html), '缺少三列蛋仓布局');
  expect(html.includes('assets/medals/1001'), '缺少大块头奖牌资源');
  expect(html.includes('assets/medals/1026'), '缺少婉转声奖牌资源');
  expect(html.includes('assets/green-nest.png'), '缺少绿窝资源');
  for (const word of forbidden) expect(!html.includes(word), `仍出现不符合实际流程的文案「${word}」`);
  expect(/菊花梨蛋[\s\S]{0,240}固执 \/ 保守[\s\S]{0,240}×1/.test(html), '同一种蛋的多性格与数量未合并到一张需求卡');
  expect(html.includes('已收到'), '缺少需求方确认收货动作');
  expect(html.includes('已完成'), '缺少需求方确认后的完成状态');
  expect(!html.includes('供给方确认'), '供给方不应出现第二个确认动作');
}

if (failures.length) {
  console.error(`原型回归检查失败（${failures.length} 项）：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`原型回归检查通过：${files.length} 份 HTML`);
}
