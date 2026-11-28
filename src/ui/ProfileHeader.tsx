import type { AccountSnapshot } from '../domain/parseBackup';
import type { ProfileAvatarPet } from '../api/profileAvatar';
import { ProfileAvatar } from './ProfileAvatar';

/** 「我的」页顶部的账号概览卡（2026-11-25 U2 方案 A）。
 *
 * 这一卡只回答三个事实：谁在用（登录态）、本机有几个游戏角色、数据有多新。
 * 数据全部由调用方传入，组件不读 store、不发请求——这样列表行与二级页都能复用同一份口径。
 */
export interface ProfileHeaderProps {
  snapshots: readonly AccountSnapshot[];
  /** 已登录的账号 id（null = 本机模式） */
  accountId: string | null;
  /** 账号名（用户名）；没有就写「已登录」 */
  accountName?: string | null;
  /** 自定义头像（2026-11-28）；null/不传 = 用户名首字 */
  avatar?: ProfileAvatarPet | null;
  /** 点头像：打开换头像弹层（未登录时由上层决定是提示还是开弹层） */
  onAvatarClick?: () => void;
  /** 右侧动作：未登录 = 登录，已登录 = 同步；都去「我的身份」 */
  onGoAccount: () => void;
  /**
   * 已登录时的「同步」（UI-01）：账号页把「立即同步」藏起来了，
   * 所以同步要走自己的落点（滚到「私有同步」卡），不能沿用到账号页。
   */
  onSync?: () => void;
}

const timeText = (value: string): string => {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '时间未知';
  return new Date(time).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function ProfileHeader({
  snapshots,
  accountId,
  accountName,
  avatar = null,
  onAvatarClick,
  onGoAccount,
  onSync,
}: ProfileHeaderProps) {
  const loggedIn = accountId != null && accountId !== '';
  const capturedAt = snapshots.reduce(
    (latest, snapshot) => (snapshot.importedAt > latest ? snapshot.importedAt : latest),
    '',
  );
  // 没有数据时不编造时间：新用户要先看到「还没有」才敢往下点
  const stateText =
    snapshots.length === 0
      ? '还没采集过数据 · 先在下面导入一次'
      : `${snapshots.length} 个角色 · 上次采集 ${timeText(capturedAt)}`;
  const nameText = loggedIn ? accountName || '已登录' : '本机模式 · 未登录';
  // 默认头像的底色：用户名优先，老账号（没有用户名）用账号 id，未登录用中性色
  const colorSeed = loggedIn ? accountName || accountId : null;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="profile-header">
      <div className="flex items-center gap-3">
        <ProfileAvatar
          testId="profile-header-avatar"
          avatar={avatar}
          name={nameText}
          colorSeed={colorSeed}
          size={56}
          onClick={onAvatarClick}
        />
        <div className="min-w-0 flex-1">
          <p
            className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900"
            data-testid="profile-header-name"
          >
            <span className="truncate">{nameText}</span>
            {loggedIn ? (
              <span className="size-[7px] shrink-0 rounded-full bg-emerald-500" aria-hidden />
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500" data-testid="profile-header-state">
            {stateText}
          </p>
        </div>
        <button
          type="button"
          onClick={loggedIn && onSync ? onSync : onGoAccount}
          data-testid="profile-header-action"
          className="min-h-[36px] shrink-0 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-medium text-emerald-700"
        >
          {loggedIn ? '同步' : '登录'}
        </button>
      </div>
    </section>
  );
}
