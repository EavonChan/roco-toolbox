import type { HomePair, HomeResident, OwnedPet } from '../domain/types';
import { buildHomePairClusters, type HomePairCluster, type HomePairNode } from './HomePairDiagram';
import { averageVoiceOf, PairingPetCard, type PairCardPet } from './NestPlanCard';
import { pairingColor } from './pairingColors';
import { useHomePairSplit } from './useWideLandscape';

/**
 * 家园「配窝卡片」（2026-11-19 用户口径）：复用配窝建议那张紧凑精灵卡（蛋组 / 奖牌 /
 * 分贝 / 身高 / 体重 / 名字），家园版 70px、不写盒子；配窝建议版 86px，卡底多一行盒子位置。
 *
 * - **一个窝一只精灵**：母本一个窝、种公也一个窝；学院 1:2 = 一公两母三个窝，公本只出现一次；
 * - 普通的一公一母 / 一公两母：卡头贴在母本上方，种公和母本顶边对齐；
 * - 任一边超过 2 只，或 2 母 2 公：少数的一方置顶——1 公 10 母时公本置顶，
 *   10 公 1 母时母本置顶，另一方两列排；不折叠，所有卡片都显示；
 * - 每只母本只按她自己配的种公算性格和声音；多公时标出配了谁；
 * - 学院小窝那只绿框。
 *
 * 性格概率按游戏规则：学院小窝 100% 跟学院那只；普通窝单方 30%、双方同性格 60%。
 * 数据只来自抓包里的实际配对（`layEggCouples`），不重新计算配对。
 */
const natureOf = (node: HomePairNode): string => node.nature || node.pet?.nature || '';

interface NatureChance {
  nature: string;
  chance: number;
}

/** 只在这只母本和她的种公里找学院小窝；不能用整簇，否则多母本会被别的学院精灵带成 100%。 */
function pairNaturesOf(
  mother: HomePairNode | null,
  males: readonly HomePairNode[],
): NatureChance[] {
  const academy = [mother, ...males].find((node) => node?.academy && natureOf(node));
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

/** 这条母本在游戏配对里实际配的种公（按 `layEggCouples` 的边，不把整簇的种公都算给她）。 */
function partnerMalesOf(cluster: HomePairCluster, female: HomePairNode): HomePairNode[] {
  const femaleIndex = cluster.nodes.indexOf(female);
  const partners = cluster.edges
    .filter(([from]) => from === femaleIndex)
    .map(([, to]) => cluster.nodes[to])
    .filter((node): node is HomePairNode => Boolean(node));
  if (partners.length > 0) return partners;
  if (cluster.edges.length === 0) {
    return cluster.nodes.filter((node) => node.gender !== '母');
  }
  return [];
}

const voiceOfPair = (female: HomePairNode, partners: readonly HomePairNode[]): number | null =>
  averageVoiceOf([
    { gender: female.gender, voiceDb: female.pet?.voiceDb },
    ...partners.map((male) => ({ gender: male.gender, voiceDb: male.pet?.voiceDb })),
  ]);

/** 住在家园、但背包里没有这只的实例：后代性格和声音未知，先不算（2026-11-22 不再提示「已放生」）。 */
const missingPetsOfPair = (
  female: HomePairNode,
  partners: readonly HomePairNode[],
): HomePairNode[] => [female, ...partners].filter((node) => !node.missing && !node.pet);

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
    // 个体三维（2026-11-22 用户口径）：家园卡底部一行「物攻+8·生命+9·速度+10」
    individualBonuses: pet?.individualBonuses,
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

/**
 * 多用例布局：少数的一方置顶（1 公 10 母 → 公本置顶；10 公 1 母 → 母本置顶），
 * 另一方在下面两列排；不折叠，所有卡片都显示。每只母本只算她自己配的那几只公本。
 */
function SharedStudLayout({
  cluster,
  males,
  females,
  index,
}: {
  cluster: HomePairCluster;
  males: readonly HomePairNode[];
  females: readonly HomePairNode[];
  index: number;
}) {
  const femaleOnTop = females.length < males.length;
  const partnerMap = new Map(
    females.map((female) => [female.actorId, partnerMalesOf(cluster, female)]),
  );
  const maleCount = new Map<string, number>();
  for (const female of females) {
    for (const male of partnerMap.get(female.actorId) ?? []) {
      maleCount.set(male.actorId, (maleCount.get(male.actorId) ?? 0) + 1);
    }
  }
  const topShared = femaleOnTop
    ? females.some((female) => (partnerMap.get(female.actorId)?.length ?? 0) > 1)
    : [...maleCount.values()].some((count) => count > 1);
  const topLabel = femaleOnTop
    ? topShared
      ? '共用母本'
      : '母本'
    : topShared
      ? '共用种公'
      : '种公';
  const bottomLabel = femaleOnTop ? '种公' : '母本';
  const top = femaleOnTop ? females : males;
  const bottom = femaleOnTop ? males : females;

  const motherCard = (female: HomePairNode) => {
    const partners = partnerMap.get(female.actorId) ?? [];
    const missing = missingPetsOfPair(female, partners);
    const voiceDb = missing.length > 0 ? null : voiceOfPair(female, partners);
    // 一只母本配超过 3 只种公：后代性格和声音不再显示（2026-11-19 用户口径）
    const manyStuds = partners.length > 3;
    // 标签只写数量，不列名字：极端配对时名字会把半宽的卡头文字挤坏（2026-11-19 用户口径）
    const partnerLabel = males.length > 1 ? `配 ${partners.length} 只种公` : null;
    return (
      <div key={female.actorId} className="flex min-w-0 flex-col gap-1">
        {missing.length === 0 ? (
          <div className="flex min-h-4 flex-wrap items-center gap-1" data-testid="home-pair-head">
            {manyStuds ? (
              <span className="text-[10px] leading-none text-slate-500">
                配 {partners.length} 只种公
              </span>
            ) : (
              <>
                <NatureChips natures={pairNaturesOf(female, partners)} />
                {voiceDb !== null ? (
                  <span className="text-[10px] leading-none text-slate-500">{voiceDb}dB</span>
                ) : null}
                {partnerLabel ? (
                  <span className="text-[9px] leading-none text-slate-400">{partnerLabel}</span>
                ) : null}
              </>
            )}
          </div>
        ) : (
          // 母本缺失也要留同高的空行，同一排卡片不能一高一低
          <div className="min-h-4" aria-hidden />
        )}
        <PairingPetCard
          pet={petCardOf(female)}
          collectedGroupIds={new Set()}
          academy={female.academy}
          home
        />
      </div>
    );
  };

  // 种公卡片上方不写文案：只保留卡片本身，配了几只母本由页头统一说明
  const maleCard = (male: HomePairNode) => (
    <div key={male.actorId} className="flex min-w-0 flex-col gap-1">
      <PairingPetCard
        pet={petCardOf(male)}
        collectedGroupIds={new Set()}
        academy={male.academy}
        home
      />
    </div>
  );

  return (
    <li
      className="rounded-xl border-l-4 bg-slate-50 px-1.5 py-1"
      style={{ borderLeftColor: pairingColor(index) }}
      data-testid="home-pair-card"
      data-layout="shared"
      data-top={femaleOnTop ? 'female' : 'male'}
    >
      <div data-testid="home-pair-shared">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-500">{topLabel}</span>
          <span className="text-[10px] text-slate-400">
            {top.length} 只 · 配 {bottom.length} 只{bottomLabel}
          </span>
        </div>
        <div className="mt-0.5 grid grid-cols-2 gap-1">
          {top.map((node) => (femaleOnTop ? motherCard(node) : maleCard(node)))}
        </div>
      </div>
      <div
        className="mt-1.5 grid grid-cols-2 items-start gap-1"
        data-testid={femaleOnTop ? 'home-pair-males' : 'home-pair-mothers'}
      >
        {bottom.map((node) => (femaleOnTop ? maleCard(node) : motherCard(node)))}
      </div>
    </li>
  );
}

/**
 * 三只一组（2026-11-22 用户口径）：三只精灵横排一行，不再折成两列。
 * 每只一列、卡宽高不变；母本的性格 / 声音卡头留在自己卡片上方，
 * 没有卡头的列也留同高空位，保证三张卡顶边对齐。竖屏放不下时 flex 自动折成 2 + 1。
 */
function TriplePairCard({
  cluster,
  females,
  males,
  index,
}: {
  cluster: HomePairCluster;
  females: readonly HomePairNode[];
  males: readonly HomePairNode[];
  index: number;
}) {
  return (
    <li
      className="rounded-xl border-l-4 bg-slate-50 px-1.5 py-1"
      style={{ borderLeftColor: pairingColor(index) }}
      data-testid="home-pair-card"
      data-layout="triple"
    >
      <div className="mt-0.5 flex flex-wrap items-start gap-1" data-testid="home-pair-triple">
        {[...females, ...males].map((node) => {
          const isMother = node.gender === '母';
          const partners = isMother ? partnerMalesOf(cluster, node) : [];
          const missing = isMother ? missingPetsOfPair(node, partners) : [];
          const voiceDb = isMother && missing.length === 0 ? voiceOfPair(node, partners) : null;
          const femaleIndex = isMother ? females.indexOf(node) : -1;
          return (
            <div key={node.actorId} className="flex w-[10rem] min-w-0 flex-col gap-1">
              <div
                className="flex h-4 flex-wrap items-center gap-1 overflow-hidden"
                data-testid={
                  isMother && missing.length === 0
                    ? femaleIndex === 0
                      ? 'home-pair-head'
                      : 'home-pair-head-extra'
                    : undefined
                }
              >
                {isMother && missing.length === 0 ? (
                  <>
                    <NatureChips natures={pairNaturesOf(node, partners)} />
                    {voiceDb !== null ? (
                      <span className="text-[10px] leading-none text-slate-500">{voiceDb}dB</span>
                    ) : null}
                  </>
                ) : null}
              </div>
              <PairingPetCard
                pet={petCardOf(node)}
                collectedGroupIds={new Set()}
                academy={node.academy}
                home
              />
            </div>
          );
        })}
      </div>
    </li>
  );
}

/**
 * 竖排的一对（2026-11-22 用户口径）：放在「两列三只」右侧的窄列里，
 * 上下叠两张卡，宽度只占一张卡（10rem），高度约等于两行三只组。
 */
function VerticalPairCard({
  cluster,
  female,
  male,
  index,
}: {
  cluster: HomePairCluster;
  female: HomePairNode;
  male: HomePairNode;
  index: number;
}) {
  const partners = partnerMalesOf(cluster, female);
  const missing = missingPetsOfPair(female, partners);
  const voiceDb = missing.length === 0 ? voiceOfPair(female, partners) : null;
  return (
    <li
      className="rounded-xl border-l-4 bg-slate-50 px-1.5 py-1"
      style={{ borderLeftColor: pairingColor(index) }}
      data-testid="home-pair-card"
      data-layout="vertical"
    >
      <div className="mt-0.5 flex w-[10rem] flex-col gap-1" data-testid="home-pair-vertical">
        {missing.length === 0 ? (
          <div
            className="flex min-h-4 flex-wrap items-center gap-1 overflow-hidden"
            data-testid="home-pair-head"
          >
            <NatureChips natures={pairNaturesOf(female, partners)} />
            {voiceDb !== null ? (
              <span className="text-[10px] leading-none text-slate-500">{voiceDb}dB</span>
            ) : null}
          </div>
        ) : null}
        <PairingPetCard
          pet={petCardOf(female)}
          collectedGroupIds={new Set()}
          academy={female.academy}
          home
        />
        <PairingPetCard
          pet={petCardOf(male)}
          collectedGroupIds={new Set()}
          academy={male.academy}
          home
        />
      </div>
    </li>
  );
}

function HomePairCard({
  cluster,
  index,
  vertical = false,
}: {
  cluster: HomePairCluster;
  index: number;
  /** 两列三只时右侧的竖排两只（2026-11-22 用户口径） */
  vertical?: boolean;
}) {
  // 缺失的公本在数据里是「未知」性别，但名字就是「公本未知」：按公方排到右列
  const females = cluster.nodes.filter((node) => node.gender === '母');
  const males = cluster.nodes.filter((node) => node.gender !== '母');
  if (vertical && females.length === 1 && males.length === 1) {
    return (
      <VerticalPairCard
        cluster={cluster}
        female={females[0]}
        male={males[0]}
        index={index}
      />
    );
  }
  /**
   * 任一边超过 2 只、或 2 母 2 公：少数的一方置顶、多数的一方两列，
   * 不再让一堆同侧卡片只对齐第一张（2026-11-19 用户口径）。
   */
  if (females.length + males.length === 3) {
    return <TriplePairCard cluster={cluster} males={males} females={females} index={index} />;
  }
  if (
    females.length > 2 ||
    males.length > 2 ||
    (females.length > 1 && males.length > 1)
  ) {
    return <SharedStudLayout cluster={cluster} males={males} females={females} index={index} />;
  }
  const firstMother = females[0] ?? null;
  const firstPartners = firstMother ? partnerMalesOf(cluster, firstMother) : males;
  /**
   * 住在家园、但背包里没有这只的实例：后代数据未知，先不显示性格概率和平均声音。
   * 只影响这只母本自己那一行，不把同簇其他母本的概率和声音一起抹掉。
   */
  const firstMissing = firstMother ? missingPetsOfPair(firstMother, firstPartners) : [];
  return (
    <li
      className="rounded-xl border-l-4 bg-slate-50 px-1.5 py-1"
      style={{ borderLeftColor: pairingColor(index) }}
      data-testid="home-pair-card"
    >
      {/*
       * 两行网格：卡头只占母本这一列的第一行；母本和右侧种公都从第二行开始，
       * 这样种公卡片和母本卡片顶边对齐，卡头又贴在母本正上方（2026-11-19 用户口径）。
       */}
      <div className="mt-0.5 grid grid-cols-2 items-start gap-1">
        {/*
         * 卡头这一行始终占位：母本缺失（背包里没有这只）时没有子代性格/声音可写，
         * 也要留出同高的空行，否则同一排配窝卡会一高一低（2026-11-22 用户口径）。
         */}
        <div
          className="col-start-1 row-start-1 flex min-h-4 flex-wrap items-center gap-1"
          data-testid={firstMother && firstMissing.length === 0 ? 'home-pair-head' : undefined}
        >
          {firstMother && firstMissing.length === 0 ? (
            <>
              <NatureChips natures={pairNaturesOf(firstMother, firstPartners)} />
              {voiceOfPair(firstMother, firstPartners) !== null ? (
                <span className="text-[10px] leading-none text-slate-500">
                  {voiceOfPair(firstMother, firstPartners)}dB
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <div
          className="col-start-1 row-start-2 flex min-w-0 flex-col gap-1"
          data-testid="home-pair-females"
        >
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
              {missingPetsOfPair(female, males).length === 0 ? (
                <div className="flex flex-wrap items-center gap-1" data-testid="home-pair-head-extra">
                  <NatureChips natures={pairNaturesOf(female, males)} />
                  {voiceOfPair(female, males) !== null ? (
                    <span className="text-[10px] leading-none text-slate-500">
                      {voiceOfPair(female, males)}dB
                    </span>
                  ) : null}
                </div>
              ) : null}
              <PairingPetCard
                pet={petCardOf(female)}
                collectedGroupIds={new Set()}
                academy={female.academy}
                home
              />
            </div>
          ))}
        </div>
        <div
          className="col-start-2 row-start-2 flex min-w-0 flex-col gap-1"
          data-testid="home-pair-males"
        >
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
  /** 三只组默认排在上方（2026-11-22 用户口径），组内保持游戏配对顺序。 */
  const ordered = [
    ...clusters.filter((cluster) => cluster.nodes.length === 3),
    ...clusters.filter((cluster) => cluster.nodes.length !== 3),
  ];
  /**
   * 两列三只 + 右侧竖排两只（2026-11-22 用户口径）：窄横屏放不下两个三只组，
   * 就把第一组两只改成竖排，放到第二列、跨前两行，填掉三只组右侧的空位。
   */
  const split = useHomePairSplit();
  const triples = ordered.filter((cluster) => cluster.nodes.length === 3);
  const firstPair = ordered.find((cluster) => cluster.nodes.length === 2);
  const verticalKey = split && triples.length >= 2 && firstPair ? firstPair.key : null;
  if (ordered.length === 0) return null;
  return (
    <ul
      className="space-y-0.5"
      data-testid="home-pair-card-list"
      data-layout={verticalKey ? 'split' : undefined}
    >
      {ordered.map((cluster, index) => (
        <HomePairCard
          key={cluster.key}
          cluster={cluster}
          index={index}
          vertical={cluster.key === verticalKey}
        />
      ))}
    </ul>
  );
}
