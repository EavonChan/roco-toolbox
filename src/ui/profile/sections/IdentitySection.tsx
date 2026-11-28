import { ProfileHeader } from '../../ProfileHeader';
import type { SectionProps } from '../types';

/**
 * 身份区块（首屏第一块，2026-11-28 重排）：
 * 回答「谁在用 / 登录态 / 本机几个游戏角色」，头像就是换头像入口。
 */
export function IdentitySection({ ctx }: SectionProps) {
  return (
    <div data-section="identity" className="space-y-s2">
      <ProfileHeader
        snapshots={ctx.snapshots}
        accountId={ctx.accountId}
        accountName={ctx.accountName}
        avatar={ctx.avatar}
        onAvatarClick={ctx.onOpenAvatar}
        onGoAccount={ctx.onGoIdentity}
      />
      {ctx.avatarNotice ? (
        <p
          role="status"
          data-testid="profile-avatar-notice"
          className={`text-caption ${
            ctx.avatarNotice.tone === 'error' ? 'text-danger' : 'text-ink-muted'
          }`}
        >
          {ctx.avatarNotice.text}
        </p>
      ) : null}
    </div>
  );
}
