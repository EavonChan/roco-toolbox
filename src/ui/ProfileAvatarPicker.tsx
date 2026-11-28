import type { ProfileAvatarPet } from '../api/profileAvatar';
import type { AvatarCandidate } from './avatarCandidates';
import { EmptyState, Section } from './kit';
import { ProfileAvatar } from './ProfileAvatar';
import { ModalSurface } from './primitives/ModalSurface';

/**
 * 换头像弹层（2026-11-28 用户拍板：A 图鉴精灵 + 点头像直接换）。
 *
 * 底部弹层而不是新页面：不丢「我的」当前的滚动位置与上下文，可关闭 / 可返回。
 * 只列本机已导入的精灵；没有就空态，不列全图鉴。点一只立刻生效（由上层写入并同步），
 * 所以这里没有「保存」按钮。
 */
export interface ProfileAvatarPickerProps {
  open: boolean;
  /** 当前已设置的头像（null = 默认首字） */
  current: ProfileAvatarPet | null;
  /** 只来自本机已导入的蛋 / 母本 */
  candidates: readonly AvatarCandidate[];
  /** 默认头像的展示名（用户名） */
  displayName: string | null;
  /** 默认头像的底色种子，与页头保持一致 */
  colorSeed: string | null;
  /** 云端正在写：暂时不允许再点 */
  busy?: boolean;
  onPick: (avatar: ProfileAvatarPet | null) => void;
  onClose: () => void;
  /** 空态里的「去导入」 */
  onGoImport?: () => void;
}

const CELL =
  'flex min-w-0 flex-col items-center gap-s1 rounded-tile border p-s2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60';

export function ProfileAvatarPicker({
  open,
  current,
  candidates,
  displayName,
  colorSeed,
  busy = false,
  onPick,
  onClose,
  onGoImport,
}: ProfileAvatarPickerProps) {
  const selectedId = current?.gameId ?? null;

  return (
    <ModalSurface
      open={open}
      placement="sheet"
      title="换头像"
      onClose={onClose}
      testId="avatar-picker"
      closeTestId="avatar-picker-close"
      backdropTestId="avatar-picker-backdrop"
    >
      <div className="p-s4">
        <Section
          title="选择"
          description="默认用用户名首字；也可以从你导入的精灵里选一只。"
          testId="avatar-picker-section"
        >
          {candidates.length === 0 ? (
            <EmptyState
              title="还没有精灵可选，先导入一次数据"
              description="导入后，这里只列你自己有的精灵。"
              testId="avatar-empty"
              action={onGoImport ? { label: '去导入', onClick: onGoImport } : undefined}
            />
          ) : (
            <div className="grid grid-cols-4 gap-s2" data-testid="avatar-options">
              <button
                type="button"
                data-testid="avatar-option-default"
                aria-pressed={selectedId == null}
                aria-label="用用户名首字做头像"
                disabled={busy}
                onClick={() => onPick(null)}
                className={`${CELL} ${
                  selectedId == null ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                }`}
              >
                <ProfileAvatar
                  avatar={null}
                  name={displayName}
                  colorSeed={colorSeed}
                  size={56}
                  alt=""
                />
                <span className="w-full truncate text-center text-caption text-ink-muted">默认</span>
              </button>

              {candidates.map((candidate) => {
                const selected = selectedId === candidate.gameId;
                return (
                  <button
                    key={candidate.gameId}
                    type="button"
                    data-testid={`avatar-option-${candidate.gameId}`}
                    aria-pressed={selected}
                    aria-label={`用 ${candidate.name} 做头像`}
                    disabled={busy}
                    onClick={() => onPick({ kind: 'pet', gameId: candidate.gameId })}
                    className={`${CELL} ${selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
                  >
                    <ProfileAvatar
                      avatar={{ kind: 'pet', gameId: candidate.gameId }}
                      name={candidate.name}
                      colorSeed={colorSeed}
                      size={56}
                      alt=""
                    />
                    <span className="w-full truncate text-center text-caption text-ink-muted">
                      {candidate.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </ModalSurface>
  );
}
