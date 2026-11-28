import { useEffect, useRef } from 'react';
import { useSnapshots } from '../ui/useSnapshots';
import { useTargetMode } from '../ui/targetModeStore';
import { beginImport, updateImportOutcome } from '../ui/importOutcomeStore';
import { consumePendingShares, ingestCaptureFiles } from './captureIngest';

/**
 * 挂在「我的 · 游戏数据」首页上的分享消费监听（2026-11-28 CLEAN2）。
 *
 * 以前这段 effect 长在 `ImportPanel` 里，而 `ImportPanel` 现在只挂在「设置」弹层里；
 * 壳内采集（`roco-share` 注入）必须始终有人接，所以监听移到首页级别。
 * App 收到 `roco-share` 会切到「我的 · 游戏数据」，本 hook 随之挂载并消费。
 */
export function useCaptureShareIngest(): void {
  const { snapshots, loaded } = useSnapshots();
  const mode = useTargetMode();
  // 晚到的分享要用最新的快照，否则「本次新增」是拿旧数据在比
  const latest = useRef({ snapshots, mode });
  latest.current = { snapshots, mode };

  useEffect(() => {
    if (!loaded) return;

    const runConsume = () => {
      void consumePendingShares((file, sourceLabel, readFile) =>
        ingestCaptureFiles({
          files: [file],
          snapshots: latest.current.snapshots,
          mode: latest.current.mode,
          sourceLabel,
          readFile,
        }),
      ).catch((error) => {
        // 解码 / 取字节失败发生在写库之前：直接落到「入库失败」，让三阶段反馈能看到
        updateImportOutcome(beginImport(), {
          local: 'failed',
          message: error instanceof Error ? error.message : '处理分享进来的数据失败',
          cloud: 'not-enabled',
        });
      });
    };

    runConsume();
    // 应用已经开着的时候分享进来，壳会派发这个事件
    window.addEventListener('roco-share', runConsume);
    return () => window.removeEventListener('roco-share', runConsume);
  }, [loaded]);
}
