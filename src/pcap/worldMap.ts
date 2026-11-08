/**
 * 大世界地图坐标（2026-11-08）。
 *
 * 游戏世界坐标：100 单位 = 1 米，x 向东、y 向南（与 `nearbyRadar` 同一套）。
 * 场景 10003 的图片与投影标定见 `public/maps/maps.json`；
 * 这里的常量必须与那份 JSON 一致（`worldMap.test.ts` 会读文件比对，防漂移）。
 */
export interface WorldMap {
  scene: number;
  name: string;
  originX: number;
  originY: number;
  /** 地图覆盖的世界边长（世界单位） */
  sideUnits: number;
  width: number;
  height: number;
  /** public/maps 下的图片文件名 */
  image: string;
}

export const WORLD_MAPS: Record<number, WorldMap> = {
  10003: {
    scene: 10003,
    name: '卡洛西亚大陆',
    originX: 306000,
    originY: 408000,
    sideUnits: 408000,
    width: 4096,
    height: 4096,
    image: '10003.webp',
  },
};

/** 世界单位 → 米 */
export const WORLD_UNITS_PER_METER = 100;

export function worldMapForScene(scene: number | string | null | undefined): WorldMap | null {
  const key = Number(scene);
  if (!Number.isFinite(key)) return null;
  return WORLD_MAPS[key] ?? null;
}

/** 地图图片的访问地址（public/maps 原样拷到 dist/maps） */
export function worldMapImageUrl(map: WorldMap): string {
  return `/maps/${map.image}`;
}

export interface MapPoint {
  x: number;
  y: number;
}

/** 世界坐标 → 地图图片像素（左上为 0,0）；不做边界裁剪，调用方按需要判断 */
export function projectToPixel(map: WorldMap, point: MapPoint): { px: number; py: number } {
  return {
    px: ((point.x - map.originX) / map.sideUnits) * map.width,
    py: ((point.y - map.originY) / map.sideUnits) * map.height,
  };
}

/** 像素 → 世界坐标（小窗点击反查 / 测试用） */
export function unprojectFromPixel(map: WorldMap, px: number, py: number): MapPoint {
  return {
    x: map.originX + (px / map.width) * map.sideUnits,
    y: map.originY + (py / map.height) * map.sideUnits,
  };
}

/** 地图上 1 像素代表多少米（4096px / 4080m ≈ 0.996 m/px） */
export function metersPerPixel(map: WorldMap): number {
  return map.sideUnits / WORLD_UNITS_PER_METER / map.width;
}

/** 世界坐标是否落在地图范围内 */
export function containsWorldPoint(map: WorldMap, point: MapPoint): boolean {
  const { px, py } = projectToPixel(map, point);
  return px >= 0 && px <= map.width && py >= 0 && py <= map.height;
}
