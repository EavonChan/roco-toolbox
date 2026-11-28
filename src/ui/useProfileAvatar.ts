import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readProfileAvatar,
  writeProfileAvatar,
  type ProfileAvatarPet,
} from '../api/profileAvatar';
import { uploadSnapshot } from '../api/sync';

/**
 * 头像状态 + 云端同步（2026-11-28 拍板：A + 云端 + 点头像直接换）。
 *
 * 选择流程：本机立刻换（乐观更新 + 写 localStorage）→ 异步 PUT 整份快照 →
 * 失败时**回滚**并给一句提示（不能显示换了其实没存）。
 *
 * 为什么用 `uploadSnapshot()` 而不是只写一个接口：头像跟 `api/sync` 的偏好机制走，
 * 云端本来就是「一个账号一份快照」，整份 PUT 复用现成的版本号 / 401 / 冲突处理，
 * 服务端不用改。代价是每次换头像会传一次快照（值本身只有几十字节）。
 */
export interface AvatarNotice {
  tone: 'error' | 'info';
  text: string;
}

export interface ProfileAvatarState {
  avatar: ProfileAvatarPet | null;
  busy: boolean;
  notice: AvatarNotice | null;
  choose: (next: ProfileAvatarPet | null) => Promise<void>;
  showNotice: (text: string, tone?: AvatarNotice['tone']) => void;
}

export function useProfileAvatar(accountId: string | null): ProfileAvatarState {
  const [avatar, setAvatar] = useState<ProfileAvatarPet | null>(() => readProfileAvatar(accountId));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<AvatarNotice | null>(null);
  // 连续点选时只让最后一次决定最终状态（前一次的回滚不能盖掉后一次）
  const runId = useRef(0);

  useEffect(() => {
    setAvatar(readProfileAvatar(accountId));
    setNotice(null);
  }, [accountId]);

  const showNotice = useCallback((text: string, tone: AvatarNotice['tone'] = 'info') => {
    setNotice({ tone, text });
  }, []);

  const choose = useCallback(
    async (next: ProfileAvatarPet | null) => {
      if (!accountId) {
        showNotice('登录后才能设置头像');
        return;
      }
      if (busy) return;
      const before = avatar;
      const run = runId.current + 1;
      runId.current = run;

      // 乐观更新：先让用户看到换了
      setAvatar(next);
      writeProfileAvatar(accountId, next);
      setNotice(null);
      setBusy(true);
      try {
        const result = await uploadSnapshot();
        // 409 = 云端刚被别的设备改过；这次头像没写进去，按失败处理
        if (!result.ok) throw new Error('conflict');
      } catch {
        if (runId.current !== run) return;
        // 回滚到点之前那一份，并明确告诉用户「没存上」
        setAvatar(before);
        writeProfileAvatar(accountId, before);
        setNotice({ tone: 'error', text: '头像没保存成功，已恢复原样' });
      } finally {
        if (runId.current === run) setBusy(false);
      }
    },
    [accountId, avatar, busy, showNotice],
  );

  return { avatar, busy, notice, choose, showNotice };
}
