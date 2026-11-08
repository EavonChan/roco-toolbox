import { buildClusterOffsets } from '../domain/nestGeometry';
import type { HomePair, HomeResident, OwnedPet } from '../domain/types';
import { NestLayoutSvg, type NestSvgLine, type NestSvgSlot } from './NestLayoutSvg';
import { pairingColor, pairingDashed } from './pairingColors';

/**
 * 家园现状的「配窝卡片」（2026-11-01 用户口径：**严格按看板「配窝建议」那张摆位图**）。
 *
 * 和配窝建议的区别：那边画的是**建议**排位（`buildNestPlans` 算出来的坐标），
 * 这边画的是**游戏里实际成立的配对**（`layEggCouples`）。抓包里的窝坐标大多为空，
 * 所以两边都不按真实坐标：同一簇内的窝用 `buildClusterOffsets` 排位。
 *
 * 排法（2026-11-01 用户口径）：一簇一张图、一行放两张，每张铺满自己的半格；不套灰底卡片
 * （一对只有两个方块，卡片底色只会显得空）。四周留白也比配窝建议小，方块才够大。
 *
 * 方块里只写名字（最多 4 字，完整名放 title）+ 性别；学院小窝那只是绿底白字。
 */

/** 配窝卡片四周留白（地板单元）：1/4 窝，只够描边不被裁，剩下的都留给方块。 */
const HOME_PAIR_PADDING = 2;

/** 展示顺序：母在左、公在右（与「配窝建议」的配对行、下面的家园精灵卡保持一致）。 */
const genderRank = (gender: HomePairNode['gender']): number =>
  gender === '母' ? 0 : gender === '公' ? 1 : 2;

/**
 * 把摆位分给这一簇的方块：先按「母 → 公 → 未知」定展示顺序，再把从左到右的摆位依次发下去。
 * `buildClusterOffsets` 只保证互不重叠、能连线，具体哪个方块落在哪一格由这里决定。
 */
function positionsOf(cluster: HomePairCluster): Array<{ x: number; y: number }> {
  const order = cluster.nodes
    .map((node, index) => ({ index, rank: genderRank(node.gender) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.index);
  const offsets = [...buildClusterOffsets(cluster.nodes.length)].sort(
    (a, b) => a.x - b.x || a.y - b.y,
  );
  const positions = cluster.nodes.map(() => ({ x: 0, y: 0 }));
  order.forEach((nodeIndex, slot) => {
    positions[nodeIndex] = offsets[slot];
  });
  return positions;
}

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
  // 实例 id 对不上时（重新抓包 / 背包里没这只）退一步按名字找，且只在「同名唯一」时采用
  const petsByName = new Map<string, OwnedPet[]>();
  for (const pet of pets.values()) {
    const list = petsByName.get(pet.name) ?? [];
    list.push(pet);
    petsByName.set(pet.name, list);
  }
  const petOf = (resident: HomeResident): OwnedPet | undefined => {
    const exact = pets.get(resident.instanceId);
    if (exact) return exact;
    const sameName = petsByName.get(resident.name);
    return sameName?.length === 1 ? sameName[0] : undefined;
  };

  const nodeOf = (actorId: string): HomePairNode => {
    const resident = residentByActor.get(actorId);
    if (!resident) {
      return { actorId, name: '公本未知', gender: '未知', academy: false, missing: true };
    }
    const pet = petOf(resident);
    return {
      actorId,
      name: resident.name || pet?.name || `精灵 ${actorId}`,
      gender:
        resident.gender === '公' || resident.gender === '母'
          ? resident.gender
          : pet?.gender === '公' || pet?.gender === '母'
            ? pet.gender
            : '未知',
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
    <div className="flex flex-wrap justify-center gap-x-2 gap-y-1" data-testid="home-pair-diagram">
      {clusters.map((cluster, clusterIndex) => {
        const positions = positionsOf(cluster);
        const slots: NestSvgSlot[] = cluster.nodes.map((node, nodeIndex) => ({
          key: node.actorId,
          name: node.name,
          gender: node.gender,
          academy: node.academy,
          missing: node.missing,
          position: positions[nodeIndex],
        }));
        const lines: NestSvgLine[] = cluster.edges.map(([from, to], edgeIndex) => ({
          key: `${cluster.key}-${edgeIndex}`,
          from: positions[from],
          to: positions[to],
          color: pairingColor(clusterIndex),
          dashed: pairingDashed(clusterIndex),
        }));
        // 一行两张、每张铺满半格；不套灰底卡片（一对只有两个方块，卡片底色只会显得空）
        return (
          <div
            key={cluster.key}
            className="flex w-[calc(50%-4px)] items-center justify-center"
            data-testid="home-pair-cluster"
          >
            <NestLayoutSvg
              slots={slots}
              lines={lines}
              label="家园实际配对"
              testId="home-pair-cluster-map"
              slotTestId="home-pair-node"
              className="mx-auto block w-[58%]"
              padding={HOME_PAIR_PADDING}
            />
          </div>
        );
      })}
    </div>
  );
}
