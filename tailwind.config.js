/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /*
       * 设计 tokens（DESIGN1，2026-11-28）：全部指向 src/ui/kit/tokens.css。
       *
       * 只新增名字，不改 Tailwind 既有档位：
       * - 没有覆盖 spacing 的 1/2/3/4、fontSize 的 sm/base、borderRadius 的 lg，
       *   所以现有页面的 class 生成结果一个字节都不变；
       * - 新名字只给 src/ui/kit/* 与后续区块用。
       */
      colors: {
        ink: {
          DEFAULT: 'var(--color-ink)',
          strong: 'var(--color-ink-strong)',
          soft: 'var(--color-ink-soft)',
          muted: 'var(--color-ink-muted)',
          faint: 'var(--color-ink-faint)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          sunken: 'var(--color-surface-sunken)',
          raised: 'var(--color-surface-raised)',
        },
        line: {
          DEFAULT: 'var(--color-line)',
          strong: 'var(--color-line-strong)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          strong: 'var(--color-accent-strong)',
          soft: 'var(--color-accent-soft)',
          line: 'var(--color-accent-line)',
        },
        warn: {
          DEFAULT: 'var(--color-warn)',
          soft: 'var(--color-warn-soft)',
          line: 'var(--color-warn-line)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          strong: 'var(--color-danger-strong)',
          soft: 'var(--color-danger-soft)',
          line: 'var(--color-danger-line)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          soft: 'var(--color-info-soft)',
          line: 'var(--color-info-line)',
        },
        female: {
          soft: 'var(--color-female-soft)',
          line: 'var(--color-female-line)',
        },
        male: {
          soft: 'var(--color-male-soft)',
          line: 'var(--color-male-line)',
        },
      },
      fontSize: {
        caption: ['var(--fs-caption)', { lineHeight: 'var(--lh-caption)' }],
        meta: ['var(--fs-meta)', { lineHeight: 'var(--lh-meta)' }],
        body: ['var(--fs-body)', { lineHeight: 'var(--lh-body)' }],
        title: ['var(--fs-title)', { lineHeight: 'var(--lh-title)' }],
        hero: ['var(--fs-hero)', { lineHeight: 'var(--lh-hero)' }],
        'egg-card': ['var(--fs-egg-card)', { lineHeight: 'var(--lh-egg-card)' }],
        'pet-micro': ['var(--fs-pet-card-micro)', { lineHeight: 'var(--lh-pet-card-micro)' }],
        'card-index': ['var(--fs-card-index)', { lineHeight: 'var(--lh-card-index)' }],
        'sim-cell': ['var(--fs-sim-cell)', { lineHeight: 'var(--lh-sim-cell)' }],
      },
      spacing: {
        s1: 'var(--space-1)',
        s2: 'var(--space-2)',
        s3: 'var(--space-3)',
        s4: 'var(--space-4)',
      },
      borderRadius: {
        chip: 'var(--radius-sm)',
        tile: 'var(--radius-md)',
        card: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      minHeight: {
        touch: 'var(--size-touch)',
        'skeleton-card': 'var(--size-skeleton-card)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
