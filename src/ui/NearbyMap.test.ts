import { afterEach, describe, expect, test } from 'vitest';
import { panForSelfMove, readSavedZoom } from './NearbyMap';
import { WORLD_MAPS, WORLD_UNITS_PER_METER } from '../pcap/worldMap';

afterEach(() => {
  window.localStorage.clear();
});

describe('附近地图缩放记忆', () => {
  test('没有记录时默认 1（150m 视野）', () => {
    expect(readSavedZoom()).toBe(1);
  });

  test('合法缩放会沿用', () => {
    window.localStorage.setItem('roco.nearbyMapZoom', '2.5');
    expect(readSavedZoom()).toBe(2.5);
  });

  test('非法值回落到默认，不把地图缩到看不见', () => {
    window.localStorage.setItem('roco.nearbyMapZoom', '0');
    expect(readSavedZoom()).toBe(1);
    window.localStorage.setItem('roco.nearbyMapZoom', 'abc');
    expect(readSavedZoom()).toBe(1);
  });
});

describe('自身移动时地图跟随（2026-11-10）', () => {
  const map = WORLD_MAPS[10003];

  test('自身向东走 1 米 → 视图反方向平移 1 米的像素数', () => {
    const view = { scale: 2, tx: 10, ty: 20 };
    const perMeter = map.width / (map.sideUnits / WORLD_UNITS_PER_METER);
    const next = panForSelfMove(
      map,
      { x: map.originX + 1000, y: map.originY + 1000 },
      { x: map.originX + 1000 + WORLD_UNITS_PER_METER, y: map.originY + 1000 },
      view,
    );
    expect(next.tx).toBeCloseTo(view.tx - perMeter * view.scale);
    expect(next.ty).toBeCloseTo(view.ty);
  });

  test('自身没动时原样返回，不触发多余重绘', () => {
    const view = { scale: 2, tx: 10, ty: 20 };
    expect(panForSelfMove(map, { x: 1, y: 2 }, { x: 1, y: 2 }, view)).toBe(view);
  });

  test('跟随不重置用户缩放', () => {
    const view = { scale: 3.5, tx: 0, ty: 0 };
    const next = panForSelfMove(
      map,
      { x: map.originX, y: map.originY },
      { x: map.originX + 40800, y: map.originY },
      view,
    );
    expect(next.scale).toBe(3.5);
    expect(next.tx).toBeLessThan(0);
  });
});
