import type { HomePair, HomeResident, OwnedPet } from '../domain/types';
import { buildHomePairClusters, type HomePairCluster, type HomePairNode } from './HomePairDiagram';
import { averageVoiceOf, PairingPetCard, type PairCardPet } from './NestPlanCard';
import { pairingColor } from './pairingColors';

/**
 * 家园「配窝卡片」（2026-11-19 用户口径）：复用补全计划里那张精灵卡（编号 / 蛋组 / 奖牌 /
 * 分贝 / 身高 / 体重 / 名字都在），家园版压缩成 104px。
 *
 * - **一个窝一只精灵**：母本一个窝、种公也一个窝；学院 1:2 = 一公两母三个窝，公本只出现一次；
 * - 卡头在母本上方：这条配对能出的性格概率 + 公母平均声音，同一行，不写性别；
 * - 上下排的多个母本，各自上方都有自己那条配对的概率（声音只写一次）；
 * - 学院小窝那只绿框；卡底不写小窝位置。
 *
 * 性格概率按游戏规则：学院小窝 100% 跟学院那只；普通窝单方 30%、双方同性格 60%。
 * 数据只来自抓包里的实际配对（`layEggCouples`），不重新计算配对。
 */
const natureOf = (node: HomePairNode): string => node.nature || node.pet?.nature || '';

interface NatureChance {
  nature: string;
  chance: number;
}

function pairNaturesOf(
  mother: HomePairNode | null,
  males: readonly HomePairNode[],
  nodes: readonly HomePairNode[],
): NatureChance[] {
  const academy = nodes.find((node) => node.academy && natureOf(node));
  if (academy) {
    const nature = natureOf(academy);
    return nature ? [{ nature, chance: 1 }] : [];
  }
  const motherNature = mother ? natureOf(mother) : '';
  const maleNatures = new Set(males.map(natureOf).filter(Boolean));
  const result: NatureChance[] = [];
  if (motherNature) {
    result.push({ nature: motherNature, chance: maleNatures.has(motherNature) ? 0.6 : 0.3 });
  }
  for (const nature of maleNatures) {
    if (nature !== motherNature) result.push({ nature, chance: 0.3 });
  }
  return result;
}

function petCardOf(node: HomePairNode): PairCardPet {
  const pet = node.pet;
  return {
    key: node.actorId,
    gameId: pet?.gameId ?? (node.baseId ? Number(node.baseId) || null : null),
    name: node.name.split('_')[0] || node.name,
    fullName: node.name,
    gender: node.gender,
    nature: natureOf(node),
    voiceDb: pet?.voiceDb,
    medalBody: pet?.medalBody,
    heightPercent: pet?.heightPercent,
    weightPercent: pet?.weightPercent,
    // 家园卡不写小窝位置（2026-11-19 用户口径）
    box: '',
  };
}

function NatureChips({ natures }: { natures: NatureChance[] }) {
  return (
    <>
      {natures.map(({ nature, chance }) => (
        <span
          key={nature}
          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-amber-700"
          data-testid="home-pair-nature"
        >
          {Math.round(chance * 100)}%{nature}
        </span>
      ))}
    </>
  );
}

function HomePairCard({ cluster, index }: { cluster: HomePairCluster; index: number }) {
  // 缺失的公本在数据里是「未知」性别，但名字就是「公本未知」：按公方排到右列
  const females = cluster.nodes.filter((node) => node.gender === '母');
  const males = cluster.nodes.filter((node) => node.gender !== '母');
  const voiceDb = averageVoiceOf(
    cluster.nodes.map((node) => ({ gender: node.gender, voiceDb: node.pet?.voiceDb })),
  );
  const firstMother = females[0] ?? null;
  return (
    <li
      className="rounded-xl border-l-4 bg-slate-50 px-1.5 py-1"
      style={{ borderLeftColor: pairingColor(index) }}
      data-testid="home-pair-card"
    >
      {/* 卡头在母本上方：性格概率 + 平均声音，同一行，不写性别 */}
      <div className="flex flex-wrap items-center gap-1" data-testid="home-pair-head">
        <NatureChips natures={pairNaturesOf(firstMother, males, cluster.nodes)} />
        {voiceDb !== null ? (
          <span className="text-[10px] leading-none text-slate-500">{voiceDb}dB</span>
        ) : null}
      </div>
      {/* 母在左列纵向排、公在右列居中；每只母本都是自己的窝 */}
      <div className="mt-0.5 grid grid-cols-2 items-center gap-1">
        <div className="flex min-w-0 flex-col gap-1" data-testid="home-pair-females">
          {firstMother ? (
            <PairingPetCard
              pet={petCardOf(firstMother)}
              collectedGroupIds={new Set()}
              academy={firstMother.academy}
              home
            />
          ) : null}
          {females.slice(1).map((female) => (
            <div key={female.actorId} className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1" data-testid="home-pair-head-extra">
                <NatureChips natures={pairNaturesOf(female, males, cluster.nodes)} />
                {voiceDb !== null ? (
                  <span className="text-[10px] leading-none text-slate-500">{voiceDb}dB</span>
                ) : null}
              </div>
              <PairingPetCard
                pet={petCardOf(female)}
                collectedGroupIds={new Set()}
                academy={female.academy}
                home
              />
            </div>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1" data-testid="home-pair-males">
          {males.map((male) => (
            <PairingPetCard
              key={male.actorId}
              pet={petCardOf(male)}
              collectedGroupIds={new Set()}
              academy={male.academy}
              home
            />
          ))}
        </div>
      </div>
    </li>
  );
}

export interface HomePairCardsProps {
  couples: readonly HomePair[];
  residents: readonly HomeResident[];
  pets: ReadonlyMap<string, OwnedPet>;
}

export function HomePairCards({ couples, residents, pets }: HomePairCardsProps) {
  const clusters = buildHomePairClusters(couples, residents, pets);
  if (clusters.length === 0) return null;
  return (
    <ul className="space-y-0.5" data-testid="home-pair-card-list">
      {clusters.map((cluster, index) => (
        <HomePairCard key={cluster.key} cluster={cluster} index={index} />
      ))}
    </ul>
  );
}
