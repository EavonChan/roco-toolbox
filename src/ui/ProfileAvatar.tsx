import { useEffect, useState } from 'react';
import type { ProfileAvatarPet } from '../api/profileAvatar';
import { petAvatarUrl } from '../domain/petAvatar';

/**
 * 头像（2026-11-28 拍板：A 图鉴精灵 + 默认用户名首字）。
 *
 * - 只负责「画」：数据由调用方给，组件不读 store、不发请求；
 * - 视觉 40/56/64px 圆形 + 1px 描边，最小触区 44px（44 ≤ 视觉尺寸，所以同一层就能满足）；
 * - 没设置 / 图片加载失败 → 用户名首字 + 稳定底色（底色由调用方给的 seed 哈希，不随机）；
 * - 只在「我的」页头和将来的成员行用，不要塞进精灵卡（性能与一致性）。
 */
export type ProfileAvatarSize = 40 | 56 | 64;

const SIZE_CLASS: Record<ProfileAvatarSize, string> = {
  40: 'size-10',
  56: 'size-14',
  64: 'size-16',
};

const IMAGE_CLASS: Record<ProfileAvatarSize, string> = {
  40: 'size-7',
  56: 'size-10',
  64: 'size-12',
};

/**
 * 默认头像的语义底色（DESIGN1 tokens）：5 档够区分，又不至于花。
 * 同一 seed（用户名，没用户名时账号 id）在任何设备上得到同一档，不能随机。
 */
const PALETTE = [
  'border-accent-line bg-accent-soft text-accent-strong',
  'border-info-line bg-info-soft text-info',
  'border-warn-line bg-warn-soft text-warn',
  'border-danger-line bg-danger-soft text-danger',
  'border-line bg-surface-raised text-ink-soft',
] as const;

/** FNV-1a：跨设备稳定（不依赖随机数 / 时间）。 */
export function avatarColorClass(seed: string | null | undefined): string {
  if (!seed) return PALETTE[PALETTE.length - 1];
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** 首字：按码点取，避免生僻字被截成半个代理对。 */
export function avatarInitial(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  return trimmed ? Array.from(trimmed)[0] ?? '?' : '?';
}

export interface ProfileAvatarProps {
  /** 已设置的头像；null = 用默认首字 */
  avatar?: ProfileAvatarPet | null;
  /** 展示名（用户名）；同时是 alt 与首字来源 */
  name?: string | null;
  /** 底色种子：用户名优先，老账号用账号 id；null/空 = 中性色（未登录） */
  colorSeed?: string | null;
  size?: ProfileAvatarSize;
  onClick?: () => void;
  disabled?: boolean;
  /** 装饰场景（外层按钮已有可读名）传空串，避免读屏重复念 */
  alt?: string;
  testId?: string;
  className?: string;
}

export function ProfileAvatar({
  avatar = null,
  name,
  colorSeed,
  size = 56,
  onClick,
  disabled = false,
  alt,
  testId = 'profile-avatar',
  className = '',
}: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);
  // 换一只精灵时重新试图片，不要把上一张的失败结果带过来
  useEffect(() => setFailed(false), [avatar?.gameId]);

  const url = avatar ? petAvatarUrl(avatar.gameId) : null;
  const showImage = url != null && !failed;
  const paint = showImage
    ? 'border-accent-line bg-surface'
    : `border ${avatarColorClass(colorSeed)}`;

  const body = showImage ? (
    <img
      src={url}
      alt={alt ?? name ?? '头像'}
      loading="lazy"
      decoding="async"
      className={`object-contain ${IMAGE_CLASS[size]}`}
      onError={() => setFailed(true)}
    />
  ) : (
    <span aria-hidden="true" className="text-hero font-semibold leading-none">
      {avatarInitial(name)}
    </span>
  );

  const base = `inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full align-middle ${SIZE_CLASS[size]} ${paint} ${className}`;

  if (onClick == null) {
    return (
      <span data-testid={testId} data-kind={showImage ? 'pet' : 'initial'} className={base}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={name ?? '头像'}
      data-testid={testId}
      data-kind={showImage ? 'pet' : 'initial'}
      className={`${base} transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
    >
      {body}
    </button>
  );
}
