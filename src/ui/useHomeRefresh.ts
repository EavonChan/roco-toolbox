import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HOME_REFRESH_POLL_MS,
  HOME_REFRESH_TIMEOUT_MS,
  canRefreshHome,
  readHomeCaptureState,
  readHomeFromCapture,
  saveRefreshedHome,
  startHomeCapture,
  stopHomeCapture,
} from './homeRefresh';

export type HomeRefreshStage = 'idle' | 'starting' | 'waiting' | 'saving' | 'done' | 'failed';

export interface HomeRefreshController {
  /** 当前环境有没有本机采集桥（网页版没有，按钮显示为不可用） */
  available: boolean;
  stage: HomeRefreshStage;
  message: string;
  start: () => void;
  /** 手动「完成刷新」：立刻读一次 */
  finish: () => void;
  cancel: () => void;
}

/**
 * 家园「刷新家园」的状态机（2026-11-01）。流程见 `homeRefresh.ts`：
 * 起短采集 → 自动/手动读当前 pcap → 只并 home → 停采集。
 */
export function useHomeRefresh(): HomeRefreshController {
  const [available] = useState(canRefreshHome);
  const [stage, setStage] = useState<HomeRefreshStage>('idle');
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const timer = useRef<number | null>(null);
  const deadline = useRef(0);
  /** 本次刷新是否还在进行：卸载时只有进行中才需要顺手停采集 */
  const active = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const fail = useCallback(
    (text: string) => {
      clearTimer();
      active.current = false;
      setStage('failed');
      setMessage(text);
      void stopHomeCapture();
    },
    [clearTimer],
  );

  const read = useCallback(
    async (auto: boolean) => {
      if (busy.current) return;
      busy.current = true;
      if (!auto) setStage('saving');
      try {
        const incoming = await readHomeFromCapture();
        if (!incoming) {
          if (!auto) {
            setStage('waiting');
            setMessage('还没读到家园数据：先在游戏里打开一次家园，再点「完成刷新」。');
          }
          return;
        }
        const merged = await saveRefreshedHome(incoming);
        if (!merged) {
          fail('本机还没有这个账号的游戏数据：先导入一次游戏数据，再用刷新家园。');
          return;
        }
        clearTimer();
        active.current = false;
        setStage('done');
        setMessage(
          `家园已更新：${merged.home?.residents.length ?? 0} 只住户、${
            merged.home?.layEggCouples.length ?? 0
          } 对配对。`,
        );
        await stopHomeCapture();
      } catch (error) {
        if (!auto) fail(error instanceof Error ? error.message : '读取家园失败，请重试');
      } finally {
        busy.current = false;
      }
    },
    [clearTimer, fail],
  );

  const start = useCallback(() => {
    if (!available || busy.current || stage === 'starting') return;
    clearTimer();
    active.current = true;
    setStage('starting');
    setMessage('');
    void (async () => {
      try {
        await startHomeCapture();
      } catch (error) {
        fail(error instanceof Error ? error.message : '无法开始采集：请允许 VPN 授权后重试');
        return;
      }
      setStage('waiting');
      setMessage('已开始刷新：进游戏 → 打开一次家园（可以走一圈），这里会自动读取。');
      deadline.current = Date.now() + HOME_REFRESH_TIMEOUT_MS;
      timer.current = window.setInterval(() => {
        void (async () => {
          if (Date.now() > deadline.current) {
            fail('等太久了，还没读到家园数据。确认进过家园后再试一次。');
            return;
          }
          const state = await readHomeCaptureState();
          if (state?.phase === 'failed') {
            fail(state.message || '采集失败，请重试');
            return;
          }
          if (state?.phase === 'idle') {
            fail('采集已经结束，但没有读到家园数据。确认进过家园后再试一次。');
            return;
          }
          await read(true);
        })();
      }, HOME_REFRESH_POLL_MS);
    })();
  }, [available, clearTimer, fail, read, stage]);

  const finish = useCallback(() => {
    void read(false);
  }, [read]);

  const cancel = useCallback(() => {
    clearTimer();
    active.current = false;
    setStage('idle');
    setMessage('已取消刷新。');
    void stopHomeCapture();
  }, [clearTimer]);

  useEffect(
    () => () => {
      clearTimer();
      // 只有本次刷新还在进行时才停采集；别把用户在「本机采集」里自己开的采集停掉
      if (active.current) void stopHomeCapture();
      active.current = false;
    },
    [clearTimer],
  );

  return { available, stage, message, start, finish, cancel };
}
