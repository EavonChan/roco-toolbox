import { buildClusterOffsets, NEST_SIZE } from '../domain/nestGeometry';
import type { HomePair, HomeResident, OwnedPet } from '../domain/types';
import { GenderMark } from './GenderMark';
import { PAIRING_COLORS, pairingColor } from './pairingColors';

/**
 * 家园现状的「配窝卡片」（2026-11-01 用户口径：用看板「配窝建议」里那张摆位图的画法）。
 *
 * 和配窝建议的区别：那边画的是**建议**排位（`buildNestPlans` 算出来的坐标），
 * 这边画的是**游戏里实际成立的配对**（`layEggCouples`）。抓包里的窝坐标大多为空，
 * 所以两边都不按真实坐标、只按配对关系紧凑排：同一簇内的窝用 `buildClusterOffsets`
 * 排成「能连上的三角形/并排」，簇与簇之间留空隙、各用一种线色。
 *
 * 方块里只写名字（最多 4 字，完整名放 title）+ 性别；学院小窝那只是绿底白字。
 */

/** 方块边长（px）。 */
const BOX = 56;
/**
 * 相邻两块的留白（px）：坐标单位是「地板单元」、1 窝 = 8 单元，
 * 这里让 1 个单元 = (BOX + GAP) / 8 像素，两块之间正好空出 GAP 给连线露出来。
 */
const GAP = 12;
const UNIT = (BOX + GAP) / NEST_SIZE;
/** 方块里只放得下 4 个字：先去形态后缀，再截断（与配窝建议的窝块一致）。 */
const SHORT_NAME_LEN = 4;

const shortName = (name: string): string => name.split('_')[0].slice(0, SHORT_NAME_LEN);

const genderOf = (value: string | undefined): '公' | '母' | '未知' =>
  value === '公' || value === '母' ? value : '未知';

export interface HomePairNode {
  actorId: string;
  /** 完整名字（title 用） */
  name: string;
  gender: '公' | '母' | '未知';
  /** 住在学院小窝：绿底白字 */
  academy: boolean;
  /** 配对里提到、但这次快照里找不到住户 */
  missing: boolean;
}

export interface HomePairCluster {
  key: string;
  nodes: HomePairNode[];
  /** 连线：nodes 下标对 */
  edges: Array<[number, number]>;
}

/**
 * 把实际配对拆成「簇」：共享同一只精灵的两条配对画在一个簇里
 * （学院小窝那只 1:2 时，绿块只画一次、两条线连两只）。
 */
export function buildHomePairClusters(
  couples: readonly HomePair[],
  residents: readonly HomeResident[],
  pets: ReadonlyMap<string, OwnedPet>,
): HomePairCluster[] {
  const residentByActor = new Map(residents.map((resident) => [resident.actorId, resident]));

  const nodeOf = (actorId: string): HomePairNode => {
    const resident = residentByActor.get(actorId);
    if (!resident) {
      return { actorId, name: '公本未知', gender: '未知', academy: false, missing: true };
    }
    const pet = pets.get(resident.instanceId);
    return {
      actorId,
      name: resident.name || pet?.name || `精灵 ${actorId}`,
      gender: genderOf(resident.gender || pet?.gender),
      academy: resident.nest?.nestType === 'academy',
      missing: false,
    };
  };

  // 并查集：共享精灵的配对归到同一簇
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current) ?? current;
    return current;
  };
  const union = (a: string, b: string): void => {
    for (const id of [a, b]) if (!parent.has(id)) parent.set(id, id);
    const [left, right] = [find(a), find(b)];
    if (left !== right) parent.set(right, left);
  };
  for (const couple of couples) {
    for (const maleActorId of couple.maleActorIds) union(couple.femaleActorId, maleActorId);
  }

  const clusters = new Map<string, HomePairCluster>();
  const indexOf = (cluster: HomePairCluster, actorId: string): number => {
    const index = cluster.nodes.findIndex((node) => node.actorId === actorId);
    if (index >= 0) return index;
    cluster.nodes.push(nodeOf(actorId));
    return cluster.nodes.length - 1;
  };

  for (const couple of couples) {
    const maleActorIds = couple.maleActorIds.filter(Boolean);
    if (!couple.femaleActorId || maleActorIds.length === 0) continue;
    const root = find(couple.femaleActorId);
    const cluster = clusters.get(root) ?? { key: root, nodes: [], edges: [] };
    clusters.set(root, cluster);
    const femaleIndex = indexOf(cluster, couple.femaleActorId);
    for (const maleActorId of maleActorIds) {
      const maleIndex = indexOf(cluster, maleActorId);
      if (!cluster.edges.some(([a, b]) => a === femaleIndex && b === maleIndex)) {
        cluster.edges.push([femaleIndex, maleIndex]);
      }
    }
  }

  return [...clusters.values()].filter((cluster) => cluster.nodes.length > 0);
}

export interface HomePairDiagramProps {
  couples: readonly HomePair[];
  residents: readonly HomeResident[];
  pets: ReadonlyMap<string, OwnedPet>;
}

export function HomePairDiagram({ couples, residents, pets }: HomePairDiagramProps) {
  const clusters = buildHomePairClusters(couples, residents, pets);
  if (clusters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-3" data-testid="home-pair-diagram">
      {clusters.map((cluster, index) => {
        const color = pairingColor(index);
        const dashed = index >= PAIRING_COLORS.length;
        // 同一簇内紧凑排位（与配窝建议同一个几何：1 窝 = 8 单元）
        const raw = buildClusterOffsets(cluster.nodes.length);
        // 贪心是从左侧找位，算出来母本可能落在右边：整体镜像一下，统一「母本在左」更好读
        const maxX = Math.max(...raw.map((position) => position.x));
        const minX = Math.min(...raw.map((position) => position.x));
        const positions =
          raw[0].x === minX ? raw : raw.map((position) => ({ x: maxX - position.x, y: position.y }));
        const width = Math.max(...positions.map((position) => position.x)) * UNIT + BOX;
        const height = Math.max(...positions.map((position) => position.y)) * UNIT + BOX;
        const centerOf = (nodeIndex: number) => ({
          x: positions[nodeIndex].x * UNIT + BOX / 2,
          y: positions[nodeIndex].y * UNIT + BOX / 2,
        });
        return (
          <div
            key={cluster.key}
            className="relative shrink-0"
            style={{ width, height }}
            data-testid="home-pair-cluster"
          >
            <svg
              className="pointer-events-none absolute inset-0"
              width={width}
              height={height}
              aria-hidden="true"
            >
              {cluster.edges.map(([from, to], edgeIndex) => {
                const start = centerOf(from);
                const end = centerOf(to);
                return (
                  <line
                    key={`${from}-${to}-${edgeIndex}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={dashed ? '4 3' : undefined}
                  />
                );
              })}
            </svg>
            {cluster.nodes.map((node, nodeIndex) => (
              <div
                key={node.actorId}
                className={`absolute flex flex-col items-center justify-center rounded-xl border ${
                  node.academy
                    ? 'border-emerald-700 bg-emerald-600 text-white'
                    : node.missing
                      ? 'border-dashed border-slate-300 bg-white text-slate-400'
                      : 'border-slate-300 bg-white text-slate-700'
                }`}
                style={{
                  left: positions[nodeIndex].x * UNIT,
                  top: positions[nodeIndex].y * UNIT,
                  width: BOX,
                  height: BOX,
                }}
                title={node.name}
                data-testid="home-pair-node"
              >
                <span className="max-w-full truncate px-1 text-[11px] font-medium leading-none">
                  {shortName(node.name)}
                </span>
                <span className="mt-1.5 leading-none">
                  <GenderMark gender={node.gender} />
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
