/**
 * DESIGN1 原语画廊（2026-11-28）。
 *
 * 目的：把 6 个原语 × 各自状态放在 375 / 390 两档并排，能看才能验收。
 * 这里渲染的是 src/ui/kit 里的真实组件（不是另画一套 HTML），
 * 样式全部来自 tokens；页面只做「摆位置」，不改组件样式。
 *
 * 构建：node tools/preview/design-kit/build.mjs
 * 截图：node tools/preview/design-kit/shot.mjs
 * 产物：docs/preview/DESIGN-kit/index.html + *.png
 */
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { Card, Chip, EmptyState, Row, Section, Skeleton } from '../../../src/ui/kit';

const TYPE_SCALE = [
  { name: 'text-hero', cls: 'text-hero', note: '18px 数字 / 主标', sample: '128' },
  { name: 'text-title', cls: 'text-title', note: '15px 区块标题', sample: '今日配窝' },
  { name: 'text-body', cls: 'text-body', note: '13px 正文', sample: '白髮懶人 · 保守 · 大块头' },
  { name: 'text-meta', cls: 'text-meta', note: '11px 次要信息', sample: '每 4 小时刷新一次' },
  { name: 'text-caption', cls: 'text-caption', note: '10px 说明文字', sample: '数据只存在本机' },
] as const;

const SWATCHES = [
  ['ink', 'bg-ink', '主文字 14.6:1'],
  ['ink-soft', 'bg-ink-soft', '正文次级 7.6:1'],
  ['ink-muted', 'bg-ink-muted', '次要信息 4.8:1'],
  ['ink-faint', 'bg-ink-faint', '占位 2.6:1（不承载正文）'],
  ['line', 'bg-line', '描边'],
  ['accent', 'bg-accent', '填充 3.8:1'],
  ['accent-strong', 'bg-accent-strong', '强调文字 5.5:1'],
  ['warn', 'bg-warn', '警告 5.0:1'],
  ['danger', 'bg-danger', '危险 6.3:1'],
  ['info', 'bg-info', '信息 5.9:1'],
] as const;

const SPACES = [
  ['s1', 'w-s1', '4px'],
  ['s2', 'w-s2', '8px'],
  ['s3', 'w-s3', '12px'],
  ['s4', 'w-s4', '16px'],
] as const;

const RADII = [
  ['rounded-chip', 'chip 6px'],
  ['rounded-tile', 'tile 8px'],
  ['rounded-card', 'card 12px'],
] as const;

/** 具名例外：只给卡内微缩字号，原语不许用（理由见 tokens.css 与交付文档） */
const EXCEPTIONS = [
  ['text-sim-cell', '6px · 仿真背包 30 格'],
  ['text-card-index', '8px · 图鉴 / 矩阵卡编号'],
  ['text-pet-micro', '9px · 精灵背包卡'],
  ['text-egg-card', '10px · 蛋卡'],
] as const;

function Demo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div data-demo={label} className="rounded-tile border border-line p-s2">
      <div className="mb-s2 flex items-baseline justify-between gap-s2">
        <span className="text-caption font-medium text-ink-soft">{label}</span>
        {hint ? <span className="text-caption text-ink-muted">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Tokens() {
  return (
    <Section title="Tokens" description="字号 5 档 / 间距 4 档 / 圆角 3 档 / 语义色">
      <div className="space-y-s1">
        {TYPE_SCALE.map((item) => (
          <div key={item.name} className="flex items-baseline justify-between gap-s2">
            <span className={`${item.cls} text-ink`}>{item.sample}</span>
            <span className="shrink-0 text-caption text-ink-muted">
              {item.name} · {item.note}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-s2 space-y-s1 rounded-tile border border-dashed border-line p-s2">
        <p className="text-caption text-ink-muted">具名例外（卡内微缩字号，原语不许用）</p>
        {EXCEPTIONS.map(([cls, note]) => (
          <div key={cls} className="flex items-baseline justify-between gap-s2">
            <span className={`${cls} text-ink-soft`}>12 · 大块头 · 保守</span>
            <span className="shrink-0 text-caption text-ink-muted">{note}</span>
          </div>
        ))}
      </div>

      <div className="mt-s3 flex items-end gap-s3">
        {SPACES.map(([name, cls, px]) => (
          <div key={name} className="flex flex-col items-start gap-s1">
            <span className={`${cls} h-s2 rounded-chip bg-accent`} />
            <span className="text-caption text-ink-muted">
              {name} {px}
            </span>
          </div>
        ))}
        <div className="flex flex-col items-start gap-s1">
          <span className="h-s2 rounded-chip bg-line-strong" />
          <span className="text-caption text-ink-muted">line</span>
        </div>
      </div>

      <div className="mt-s3 flex gap-s2">
        {RADII.map(([cls, label]) => (
          <div key={cls} className="flex flex-col items-start gap-s1">
            <span className={`${cls} h-s4 w-s4 border border-accent-line bg-accent-soft shadow-card`} />
            <span className="text-caption text-ink-muted">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-s3 grid grid-cols-2 gap-s1">
        {SWATCHES.map(([name, cls, usage]) => (
          <div key={name} className="flex items-center gap-s1">
            <span className={`${cls} h-s3 w-s3 shrink-0 rounded-chip border border-line`} />
            <span className="truncate text-caption text-ink-soft">{name}</span>
            <span className="sr-only">{usage}</span>
          </div>
        ))}
      </div>
      <p className="mt-s2 text-caption text-ink-faint">
        accent 只做填充 / 描边 / 图标；小字用 accent-strong。ink-faint 只做占位。
      </p>
    </Section>
  );
}

function CardDemos() {
  return (
    <Section title="Card" description="容器：圆角 / 描边 / 内边距 / 标题行（可选 action、dense）">
      <div className="space-y-s2">
        <Demo label="默认" hint="title + action">
          <Card title="今日配窝" action={<span>3 窝</span>}>
            <p className="text-body text-ink-soft">两只大块头，目标性格保守。</p>
          </Card>
        </Demo>
        <Demo label="密集" hint="dense：内边距 12 → 8">
          <Card title="蛋仓" action={<span>12 枚</span>} dense>
            <p className="text-caption text-ink-muted">蓝蛋 5 · 绿蛋 7</p>
          </Card>
        </Demo>
        <Demo label="长标题" hint="不撑破卡片">
          <Card title="这是一个非常长的区块标题，用来验证它不会把右侧动作挤出去" action={<span>查看</span>}>
            <p className="text-caption text-ink-muted">标题换行或省略，动作始终在右上角。</p>
          </Card>
        </Demo>
        <Demo label="无标题" hint="只有内容">
          <Card>
            <p className="text-body text-ink-soft">没有标题行时不留空白。</p>
          </Card>
        </Demo>
        <Demo label="空内容" hint="没有 children 时不撑高度">
          <Card title="本次新增" action={<span>0</span>} />
        </Demo>
      </div>
    </Section>
  );
}

function RowDemos() {
  return (
    <Section title="Row" description="列表行：左图标 / 主文案 / 副文案 / 右侧值；长文案截断、可点击、可禁用">
      <div className="space-y-s2">
        <Demo label="默认">
          <div className="divide-y divide-line">
            <Row icon={<span>◆</span>} primary="白髮懶人" secondary="保守 · 大块头" value="12" />
            <Row icon={<span>◇</span>} primary="布灵" secondary="固执 · 大块头" value="8" />
          </div>
        </Demo>
        <Demo label="长文案" hint="截断，不挤压右侧值">
          <Row
            icon={<span>◆</span>}
            primary="超级无敌长的精灵名字会一直写到卡片外面去吗"
            secondary="这一段副文案也很长，用来验证省略号而不是换行撑高"
            value="128"
          />
        </Demo>
        <Demo label="可点击" hint="button + 点击态">
          <div className="divide-y divide-line">
            <Row icon={<span>→</span>} primary="去导入数据" value="›" onClick={() => {}} />
          </div>
        </Demo>
        <Demo label="禁用" hint="不可点，读屏跳过">
          <Row icon={<span>◆</span>} primary="云同步（未登录）" secondary="登录后可用" value="—" disabled onClick={() => {}} />
        </Demo>
      </div>
    </Section>
  );
}

function ChipDemos() {
  return (
    <Section title="Chip" description="状态 / 筛选标签：选中、未选中、可关闭">
      <div className="space-y-s2">
        <Demo label="筛选" hint="未选中 / 选中">
          <div className="flex flex-wrap gap-s1">
            <Chip>草系</Chip>
            <Chip selected>草系</Chip>
            <Chip>龙系</Chip>
            <Chip selected>龙系</Chip>
          </div>
        </Demo>
        <Demo label="状态色">
          <div className="flex flex-wrap gap-s1">
            <Chip tone="accent">已收集</Chip>
            <Chip tone="warn">缺数据</Chip>
            <Chip tone="danger">导入失败</Chip>
            <Chip tone="info">计划中</Chip>
          </div>
        </Demo>
        <Demo label="可关闭" hint="× 有读屏名「移除」">
          <div className="flex flex-wrap gap-s1">
            <Chip onRemove={() => {}}>草系</Chip>
            <Chip onRemove={() => {}} selected onToggle={() => {}}>
              保守
            </Chip>
          </div>
        </Demo>
        <Demo label="长文案 / 禁用">
          <div className="flex flex-wrap items-center gap-s1">
            <Chip>五十六个民族五十六朵花五十六个兄弟姐妹是一家五十六种语言汇成一句话</Chip>
            <Chip disabled>禁用</Chip>
            <Chip disabled onRemove={() => {}}>
              禁用可关闭
            </Chip>
          </div>
        </Demo>
      </div>
    </Section>
  );
}

function SectionDemos() {
  return (
    <Section title="Section" description="区块外壳：标题 + 说明 + 内容 + 空态；可选右侧动作与折叠">
      <div className="space-y-s3">
        <Demo label="默认" hint="标题 + 说明 + 内容">
          <Section title="今日待办" description="每 4 小时刷新一次">
            <p className="text-body text-ink-soft">给白髮懶人配一窝。</p>
          </Section>
        </Demo>
        <Demo label="右侧动作">
          <Section title="近邻目标" description="500 米内" action={<span className="text-meta text-accent-strong">刷新</span>}>
            <p className="text-caption text-ink-muted">3 个未认领的窝。</p>
          </Section>
        </Demo>
        <Demo label="可折叠" hint="展开 / 收起">
          <Section title="筛选" collapsible>
            <p className="text-caption text-ink-muted">蛋组 / 性格 / 身高。</p>
          </Section>
        </Demo>
        <Demo label="折叠收起">
          <Section title="筛选" collapsible defaultOpen={false}>
            <p className="text-caption text-ink-muted">收起时内容隐藏，标题行常驻。</p>
          </Section>
        </Demo>
        <Demo label="空态" hint="没有内容时">
          <Section title="配窝建议" empty={<EmptyState title="还没有可配的窝" description="导入一次抓包数据后会出现" />} />
        </Demo>
      </div>
    </Section>
  );
}

function SkeletonDemos() {
  return (
    <Section title="Skeleton" description="加载占位：高度稳定，不引起布局跳动">
      <div className="space-y-s2">
        <Demo label="一行">
          <Skeleton />
        </Demo>
        <Demo label="三行" hint="最后一行半宽">
          <Skeleton lines={3} />
        </Demo>
        <Demo label="列表行" hint="min-h-touch">
          <Skeleton height="row" />
        </Demo>
        <Demo label="卡片" hint="min-h-skeleton-card">
          <Skeleton height="card" />
        </Demo>
      </div>
    </Section>
  );
}

function EmptyStateDemos() {
  return (
    <Section title="EmptyState" description="空态：一句事实 + 一个动作；不写教学文案">
      <div className="space-y-s2">
        <Demo label="只有事实">
          <EmptyState title="还没有数据" />
        </Demo>
        <Demo label="事实 + 动作">
          <EmptyState
            title="这个账号还没有蛋"
            description="导入一次抓包数据后会出现"
            action={{ label: '去导入数据', onClick: () => {} }}
          />
        </Demo>
        <Demo label="图标可选">
          <EmptyState
            icon={<span className="text-hero">◇</span>}
            title="还没有配窝建议"
            description="换一个账号或等下次刷新"
            action={{ label: '换账号', onClick: () => {} }}
          />
        </Demo>
      </div>
    </Section>
  );
}

function Column({ width }: { width: 375 | 390 }) {
  return (
    <div
      data-testid={`gallery-${width}`}
      data-col={width}
      className="shrink-0 overflow-hidden rounded-card border border-line bg-surface shadow-card"
      style={{ width }}
    >
      <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-s3 py-s2">
        <span className="text-meta font-semibold text-ink">{width} × 812</span>
        <span className="text-caption text-ink-muted">DESIGN1 · 原语画廊</span>
      </div>
      <div className="space-y-s4 p-s3">
        <Tokens />
        <CardDemos />
        <RowDemos />
        <ChipDemos />
        <SectionDemos />
        <SkeletonDemos />
        <EmptyStateDemos />
        <p className="text-caption text-ink-muted">
          原语只引 tokens；本轮未被任何页面引用，删除 src/ui/kit 即回退。
        </p>
      </div>
    </div>
  );
}

function Gallery() {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="border-b border-line bg-surface px-s4 py-s3">
        <h1 className="text-title font-semibold text-ink-strong">DESIGN1 · tokens + 6 个基础原语</h1>
        <p className="mt-s1 text-caption text-ink-muted">
          375 与 390 两档并排；组件来自 src/ui/kit，视觉只来自 src/ui/kit/tokens.css。
        </p>
      </header>
      <div className="flex items-start justify-center gap-s4 p-s4" data-testid="gallery-columns">
        <Column width={375} />
        <Column width={390} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Gallery />);
