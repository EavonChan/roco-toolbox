import { useEffect, useState, type CSSProperties } from 'react';
import type { OwnedPet, SpeciesEntry } from '../domain/types';
import { PetCard } from './PetCard';

export interface PetListProps {
  pets: OwnedPet[];
  speciesByGameId: Map<number, SpeciesEntry>;
  eggGroupNames: Record<number, string>;
  showCount?: boolean;
  /** 卡片网格列数（2026-11-18 用户口径：三列时卡片内容整体放大、一行铺满；宽横屏可到 5/6） */
  columns?: 3 | 4 | 5 | 6;
}

/**
 * 三列模式的缩放倍数：
 * 四列时卡片宽度 ≈ (W - 3*gap)/4，三列时 ≈ (W - 2*gap)/3，两者之比约 1.35，
 * 用 CSS zoom 让字号、头像、奖牌、圆角一起等比放大（不用改卡片里的每一处尺寸）。
 */
const THREE_COLUMN_ZOOM = 1.35;

/**
 * 首屏先渲染这么多张卡，滚动靠近底部再续一屏。
 *
 * 口径仍是「全部展示、不分页」（2026-11-18 用户要求），但 500 只的账号一进页面
 * 就建 500 张卡会把安卓 WebView 卡住；按可视区逐步追加，滚动体验和全量渲染一致。
 */
const RENDER_CHUNK = 60;
/** 距底部还有这么多像素时预加载下一屏，用户滚到底不会先看到空白 */
const LOAD_MORE_THRESHOLD_PX = 400;

export function PetList({
  pets,
  speciesByGameId,
  eggGroupNames,
  showCount = true,
  columns = 4,
}: PetListProps) {
  const zoomStyle: CSSProperties | undefined =
    columns === 3 ? { zoom: THREE_COLUMN_ZOOM } : undefined;

  const [limit, setLimit] = useState(RENDER_CHUNK);
  // 搜索 / 筛选改变结果集时从头开始渲染，避免旧窗口把新结果截掉
  useEffect(() => {
    setLimit(RENDER_CHUNK);
  }, [pets]);

  useEffect(() => {
    if (limit >= pets.length) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const viewportBottom = window.scrollY + window.innerHeight;
      if (viewportBottom >= doc.scrollHeight - LOAD_MORE_THRESHOLD_PX) {
        setLimit((current) => Math.min(current + RENDER_CHUNK, pets.length));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [limit, pets.length]);

  const renderedPets = limit >= pets.length ? pets : pets.slice(0, limit);

  return (
    <div className="space-y-2">
      {showCount ? (
        <p className="text-xs text-slate-500" data-testid="pet-count">
          共 {pets.length} 只
        </p>
      ) : null}

      {/* 一行四张 / 三张：移动端保持紧凑卡片网格 */}
      <ul
        className={`grid gap-1.5 ${columns === 3 ? 'grid-cols-3' : columns === 4 ? 'grid-cols-4' : ''}`}
        style={columns > 4 ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
        data-testid="pet-list-items"
        data-columns={columns}
      >
        {renderedPets.map((pet, index) => (
          <li key={`${pet.account}-${pet.gameId}-${index}`} style={zoomStyle}>
            <PetCard
              pet={pet}
              species={speciesByGameId.get(pet.gameId)}
              eggGroupNames={eggGroupNames}
            />
          </li>
        ))}
      </ul>
      {limit < pets.length ? (
        <p className="text-center text-[11px] text-slate-400" data-testid="pet-list-more">
          已显示 {renderedPets.length} / {pets.length} 只，继续下滑加载更多
        </p>
      ) : null}
    </div>
  );
}