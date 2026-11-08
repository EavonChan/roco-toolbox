import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  WORLD_MAPS,
  containsWorldPoint,
  metersPerPixel,
  projectToPixel,
  unprojectFromPixel,
  worldMapForScene,
} from './worldMap';

describe('大世界地图投影', () => {
  test('场景 10003 的标定与 public/maps/maps.json 一致（防两处漂移）', () => {
    const file = path.resolve(process.cwd(), 'public/maps/maps.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const entry = raw.maps['10003'];
    const map = WORLD_MAPS[10003];
    expect(map.name).toBe(entry.name);
    expect(map.originX).toBe(entry.origin_x);
    expect(map.originY).toBe(entry.origin_y);
    expect(map.sideUnits).toBe(entry.side_units);
    expect(map.width).toBe(entry.declared_width);
    expect(map.height).toBe(entry.declared_height);
    expect(raw.coordinate_units_per_meter).toBe(100);
  });

  test('真实抓包坐标落在图内，投影与反投影可互逆', () => {
    const map = worldMapForScene('10003')!;
    expect(map).not.toBeNull();
    const pet = { x: 616845, y: 663625 };
    const { px, py } = projectToPixel(map, pet);
    expect(px).toBeCloseTo(3121, 0);
    expect(py).toBeCloseTo(2566, 0);
    expect(containsWorldPoint(map, pet)).toBe(true);
    const back = unprojectFromPixel(map, px, py);
    expect(back.x).toBeCloseTo(pet.x, 0);
    expect(back.y).toBeCloseTo(pet.y, 0);
    // 4080m / 4096px
    expect(metersPerPixel(map)).toBeCloseTo(0.996, 3);
  });

  test('没有地图的场景返回 null，不误画', () => {
    expect(worldMapForScene(30001)).toBeNull();
    expect(worldMapForScene(null)).toBeNull();
    expect(worldMapForScene('bad')).toBeNull();
  });
});
