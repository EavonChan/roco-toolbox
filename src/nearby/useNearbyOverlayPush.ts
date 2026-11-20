import { useEffect, useMemo, useRef, useState } from 'react';
import type { CollectorState } from '../collector/nativeCollector';
import { readCollectorState } from '../collector/nativeCollector';
import { useBattleTarget } from '../collector/battleTargetStore';
import { freshNearbySnapshot, useNearbySnapshot } from '../collector/nearbyStore';
import { registerLiveTick } from '../collector/useCaptureProgress';
import { species } from '../data/catalog';
import { demandHitsForPet, demandSpeciesIndex, type DemandHit } from '../pcap/demandMatch';
import { demandKeyOf } from '../shared/collectionGroups';
import { useDemandCenter } from '../ui/useDemandCenter';
import { useNearbyFilter } from './nearbyFilterStore';
import { useNearbyTargets } from './nearbyTargetStore';
import { hasNearbyOverlayShell, pushNearbyOverlayToShell } from './overlayBridge';
import { buildNearbyOverlayPayload } from './overlayPayload';
import { useNearbyOverlayPanels } from './overlayPanels';

/**
 * 推送节流（2026-11-10：800 → 500 → 250）。
 *
 * 节流窗口内不再直接丢帧：命中节流时记一个尾随补发，窗口一结束就推「最新」快照。
 * 所以最坏延迟 = 一轮解码 + 一个窗口，而不是随机丢掉几帧、让画面停在旧坐标上。
 * 250ms 与解码下限（useCaptureProgress 的 250ms）对齐，两边不会互相干等。
 */
const PUSH_INTERVAL_MS = 250;
/** 采集状态轮询间隔（页面可见时；不可见时由安卓壳的心跳唤醒）；解码是增量的，实测解析 <1ms */
const STATE_POLL_MS = 800;

const DEMAND_INDEX = demandSpeciesIndex(species);

/**
 * 安卓壳悬浮面板的推送生命周期（2026-11-08，应用级）。
 *
 * 之前推送只挂在「附近」页：从「我的」页发起采集时没有面板，切页即卸载、
 * 壳停在最后一帧，停采集也不会收起。现在挂在 App 上跟随采集状态：
 * - 采集中按节流推送最新附近数据；面板开关变化立即重推；
 * - 采集停止（含 stopping）推一次 `visible=false` 让壳收起；
 * - 页面卸载 / 重载时兜底推一次收起，避免壳停在最后一帧。
 *
 * 旧 APK 没有 `updateNearbyOverlay` 时整个 hook 不做事，网页不受影响。
 */
export function useNearbyOverlayPush(): void {
  const supported = hasNearbyOverlayShell();
  const [state, setState] = useState<CollectorState | null>(null);
  // 换局后旧会话的附近数据不再推给壳（O-9），停止采集仍保留同一 session 的最后一帧
  const snapshot = freshNearbySnapshot(useNearbySnapshot(), state?.fileId);
  const panels = useNearbyOverlayPanels();
  const { items: demands, reload: reloadDemands } = useDemandCenter(supported);
  // 列表口径与附近页共用同一份状态：顶部三档（含目标档）+ 战斗目标的维度筛选 + 蹲守名单
  const filter = useNearbyFilter();
  const target = useBattleTarget();
  const targets = useNearbyTargets();

  /**
   * 需求中心签名：只取影响匹配的条件，避免每次刷新都拿到新数组身份把推送打成每秒一次。
   * 需求没变就不重推，变了才推。
   */
  const demandSignature = useMemo(
    () => [...new Set(demands.map((demand) => demandKeyOf(demand)))].sort().join('|'),
    [demands],
  );
  /** 与「附近」页同一口径：命中需求中心的精灵才进面板列表 */
  const hitByKey = useMemo(() => {
    const map = new Map<string, DemandHit[]>();
    for (const pet of snapshot?.pets ?? []) {
      map.set(pet.key, demandHitsForPet(pet, demands, DEMAND_INDEX));
    }
    return map;
  }, [snapshot, demands]);
  const hitByKeyRef = useRef(hitByKey);
  hitByKeyRef.current = hitByKey;

  // 轮询采集状态：可见时定时读；不可见时挂在壳的心跳上（定时器会被 WebView 节流）
  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    let reading = false;
    const read = () => {
      if (disposed || reading) return;
      reading = true;
      readCollectorState()
        .then((next) => { if (!disposed) setState(next); })
        .catch(() => { /* 读不到就保持上一帧，等下一次轮询 */ })
        .finally(() => { reading = false; });
    };
    read();
    const timer = window.setInterval(() => {
      if (!document.hidden) read();
    }, STATE_POLL_MS);
    const unregisterTick = registerLiveTick(read);
    const onVisibility = () => read();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      unregisterTick();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [supported]);

  const capturing = state?.phase === 'capturing';

  /**
   * 采集期间定期刷新需求命中（R9-2b-M01）。
   *
   * 只在页面上挂一次 60 秒缓存，采集可能持续很久；发布方中途改条件 / 新需求时，
   * 悬浮窗的命中列表不该等到重进页面才更新。页面重新可见时也补拉一次。
   */
  useEffect(() => {
    if (!supported || !capturing) return;
    const refresh = () => {
      if (!document.hidden) reloadDemands();
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [supported, capturing, reloadDemands]);
  const latest = useRef({ snapshot, hasKey: Boolean(snapshot?.hasKey) });
  latest.current = { snapshot, hasKey: Boolean(snapshot?.hasKey) };
  /** 尾随补发读的都是 ref：定时器触发时补推的一定是最新一帧，而不是排期那一刻的旧数据。 */
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const targetRef = useRef(target);
  targetRef.current = target;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const pushed = useRef(false);
  const lastPushAt = useRef(0);
  /** 上一次真正推给壳的稳定内容签名（不含 perf / updatedAt），用于跳过无变化推送 */
  const lastPayloadSignature = useRef('');
  /** 面板开关变化时强制补推一次配置（内容没变也要发） */
  const configNonce = useRef(0);
  const panelsSignature = useRef('');
  /** 尾随补发的定时器：同一时刻只排一个，重复排期没有意义。 */
  const pendingPush = useRef<number | null>(null);

  // 跟随采集状态推送（与页面是否挂载无关）
  useEffect(() => {
    if (!supported) return;
    const signature = `${panels.battle}-${panels.nearby}`;
    const panelsChanged = panelsSignature.current !== signature;
    panelsSignature.current = signature;
    if (panelsChanged) configNonce.current += 1;

    const push = (visible: boolean) => {
      if (pendingPush.current != null) {
        window.clearTimeout(pendingPush.current);
        pendingPush.current = null;
      }
      pushed.current = visible;
      lastPushAt.current = Date.now();
      const payload = buildNearbyOverlayPayload({
        capturing: visible,
        hasKey: latest.current.hasKey,
        snapshot: latest.current.snapshot,
        demandHits: hitByKeyRef.current,
        filter: filterRef.current,
        target: targetRef.current,
        targets: targetsRef.current,
      });
      // 数据没变化就不推：以前 250ms 无条件推，实体堆积时每次都让壳重建地图（2026-11-12）
      const signature = JSON.stringify([
        visible, configNonce.current, payload.pets, payload.mapPets, payload.self, payload.scene,
        payload.total, payload.matched, payload.alertTotal, payload.rareTotal,
      ]);
      if (signature === lastPayloadSignature.current) return;
      lastPayloadSignature.current = signature;
      void pushNearbyOverlayToShell(payload);
    };

    /**
     * 尾随补发（2026-11-10）：节流窗口内又来新帧时不丢，排一个「窗口结束」的补推。
     * 补推走 push()、读最新 ref，等于把窗口内所有帧压成最后一帧——最坏多等一个窗口，
     * 但绝不会出现「这一帧被丢掉、画面停在旧坐标」。
     */
    const scheduleTrailing = () => {
      if (pendingPush.current != null) return;
      const wait = Math.max(0, PUSH_INTERVAL_MS - (Date.now() - lastPushAt.current));
      pendingPush.current = window.setTimeout(() => {
        pendingPush.current = null;
        // 期间已停止采集 / 页面卸载：不要再把面板推回来
        if (!pushed.current) return;
        push(true);
      }, wait);
    };

    if (!capturing) {
      // 停止采集：必须显式推一次收起（没推过就不用推）
      if (pushed.current) push(false);
      return;
    }
    // 第一次推、或开关变化立即推；其余按节流（命中节流时排尾随补发，不丢帧）
    if (pushed.current && !panelsChanged) {
      if (Date.now() - lastPushAt.current < PUSH_INTERVAL_MS) {
        scheduleTrailing();
        return;
      }
    }
    push(true);
  }, [supported, capturing, snapshot, panels, demandSignature, filter, target, targets]);

  // 页面卸载 / 重载兜底收起，避免壳停在最后一帧
  useEffect(() => {
    if (!supported) return;
    const hide = () => {
      if (!pushed.current) return;
      pushed.current = false;
      void pushNearbyOverlayToShell(buildNearbyOverlayPayload({
        capturing: false,
        hasKey: latest.current.hasKey,
        snapshot: latest.current.snapshot,
        demandHits: hitByKeyRef.current,
      }));
    };
    window.addEventListener('pagehide', hide);
    return () => {
      window.removeEventListener('pagehide', hide);
      hide();
      // 卸载后尾随补发不能再把面板推回来
      if (pendingPush.current != null) {
        window.clearTimeout(pendingPush.current);
        pendingPush.current = null;
      }
    };
  }, [supported]);
}
