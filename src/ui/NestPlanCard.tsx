import { useState } from 'react';
import { eggGroupNames, species } from '../data/catalog';
import { gradeLabel, heightMetersOf, weightKgOf } from '../domain/petFilters';
import { petBodyMedalIcon, petVoiceMedalIcon } from '../domain/petIcons';
import type {
  NestPairing,
  NestPet,
  NestPlan,
  UnfilledItem,
} from '../domain/nestPlan';
import {
  recommendedNatureChance,
  type MotherNestAccount,
  type MotherNestPairing,
  type MotherNestTask,
} from '../domain/motherNest';
import { speciesDisplayName } from '../domain/speciesName';
import { GenderMark } from './GenderMark';
import { NestLayoutSvg } from './NestLayoutSvg';
import { NEST_SIZE, nestsConnect, type NestPosition } from '../domain/nestGeometry';
import { genderShareOf } from '../domain/genderRatio';
import { PetAvatar } from './PetAvatar';
import { pairingColor, pairingDashed } from './pairingColors';
import { formatPercent } from './formatPercent';
import { getMyPetsSizeUnit } from './myPetsFilterStore';
import { addStudTransferTask, type StudTransferTask } from './studTransferTaskStore';
import { useTargetMode } from './targetModeStore';

const speciesByGameId = new Map(species.map((entry) => [entry.gameId, entry]));

export const CHIP = 'rounded bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none text-slate-600';
/** 双组：两个蛋组名直接用原来「双组」角标的紫色 */
export const DUAL_CHIP =
  'rounded bg-violet-50 px-1.5 py-0.5 text-[10px] leading-none font-medium text-violet-700';
/** 缺口没排上的原因（2026-11-18 新增 male-scarce：这个组没有能出公的母方） */
const UNFILLED_REASON: Record<UnfilledItem['reason'], string> = {
  'no-room': '窝位不够',
  'has-mother': '缺带这个性格的公',
  'to-collect': '缺带这个性格的母',
  'male-scarce': '这个组没有能出公的母方',
};
export const groupName = (groupId: number): string => eggGroupNames[groupId] ?? `蛋组${groupId}`;

interface PairingStyle {
  color: string;
  dashed: boolean;
}

/** 一条配对的展示键（同一对精灵补多个性格 → 同一行；同名同内容的两只精灵 key 不同，不会被并） */
const viewKeyOf = (pairing: NestPairing): string =>
  pairing.academyParent
    ? `academy|${pairing.academyParent.key}|${pairing.grade}`
    : `normal|${pairing.mother.key}|${pairing.father.key}|${pairing.grade}`;

/**
 * 摆位图：按坐标把窝画出来（绿块=学院小窝），线=会配对的边。
 * 画法已抽到 `NestLayoutSvg`（家园现状的配窝卡片共用同一张图，2026-11-01）。
 *
 * 2026-11-18：母本配窝线也画进来（黄线）。母本 / 公如果已经在种公摆位图里就复用原位置，
 * 缺的那只放在已有那只旁边；两只都还没进图时在下方另起一行，避免和种公簇串线。
 */
function NestLayoutMap({
  plan,
  styleByKey,
  motherPairings = [],
}: {
  plan: NestPlan;
  styleByKey: Map<string, PairingStyle>;
  motherPairings?: MotherNestPairing[];
}) {
  const slots = plan.slots.map((slot, index) => ({
    key: `${index}`,
    name: slot.pet.name,
    gender: slot.pet.gender,
    academy: slot.academy,
    position: slot.position,
  }));
  const lines = plan.pairings.map((pairing, index) => ({
    key: `${index}`,
    from: pairing.fatherPosition,
    to: pairing.motherPosition,
    color: styleByKey.get(viewKeyOf(pairing))?.color ?? '#64748b',
    dashed: styleByKey.get(viewKeyOf(pairing))?.dashed,
  }));
  if (motherPairings.length > 0) {
    const positions = new Map<string, NestPosition>();
    const used = new Set<string>();
    for (const slot of plan.slots) {
      positions.set(slot.pet.key, slot.position);
      used.add(`${slot.position.x},${slot.position.y}`);
    }
    const xs = plan.slots.map((slot) => slot.position.x);
    const ys = plan.slots.map((slot) => slot.position.y);
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    let rowY = (ys.length > 0 ? Math.max(...ys) : 0) + NEST_SIZE + 8;
    let cursorX = minX;
    const free = (position: NestPosition): boolean =>
      !used.has(`${position.x},${position.y}`);
    const occupy = (pet: NestPet, position: NestPosition) => {
      positions.set(pet.key, position);
      used.add(`${position.x},${position.y}`);
      slots.push({
        key: `mother-${pet.key}`,
        name: pet.name,
        gender: pet.gender,
        academy: false,
        position,
      });
    };
    /** 贴着已有那只放：右、左、下、上，再按网格找空位 */
    const beside = (base: NestPosition): NestPosition => {
      const candidates: NestPosition[] = [
        { x: base.x + NEST_SIZE, y: base.y },
        { x: base.x - NEST_SIZE, y: base.y },
        { x: base.x, y: base.y + NEST_SIZE },
        { x: base.x, y: base.y - NEST_SIZE },
      ];
      const hit = candidates.find(free);
      if (hit) return hit;
      let x = base.x + NEST_SIZE * 2;
      let y = base.y;
      while (!free({ x, y })) {
        x += NEST_SIZE;
        if (x > base.x + NEST_SIZE * 8) {
          x = base.x - NEST_SIZE * 2;
          y += NEST_SIZE;
        }
      }
      return { x, y };
    };
    for (const [index, pairing] of motherPairings.entries()) {
      let motherPos = positions.get(pairing.mother.key) ?? null;
      let fatherPos = positions.get(pairing.father.key) ?? null;
      if (!motherPos && !fatherPos) {
        // 两只都没进图：下方另起一行，一对一对排开
        while (!free({ x: cursorX, y: rowY }) || !free({ x: cursorX + NEST_SIZE, y: rowY })) {
          cursorX += NEST_SIZE;
        }
        motherPos = { x: cursorX, y: rowY };
        fatherPos = { x: cursorX + NEST_SIZE, y: rowY };
        cursorX += NEST_SIZE * 3;
        if (cursorX > minX + NEST_SIZE * 6) {
          cursorX = minX;
          rowY += NEST_SIZE + 8;
        }
      } else if (!motherPos && fatherPos) {
        motherPos = beside(fatherPos);
      } else if (motherPos && !fatherPos) {
        fatherPos = beside(motherPos);
      }
      if (!motherPos || !fatherPos) continue;
      if (!positions.has(pairing.mother.key)) occupy(pairing.mother, motherPos);
      if (!positions.has(pairing.father.key)) occupy(pairing.father, fatherPos);
      lines.push({
        key: `mother-${index}`,
        from: motherPos,
        to: fatherPos,
        color: '#f59e0b',
        dashed: !nestsConnect(motherPos, fatherPos),
      });
    }
  }
  if (slots.length === 0) return null;
  return (
    <div>
      <NestLayoutSvg slots={slots} lines={lines} />
      {motherPairings.length > 0 ? (
        <p className="mt-0.5 text-center text-[10px] text-amber-600">
          黄线 = 母本配窝（虚线 = 两只还没摆在一起）
        </p>
      ) : null}
    </div>
  );
}

/** 一条配对（同一对精灵能补多个性格 → 合并成一条；学院 1:2 也合并成一条） */
interface PairingView {
  key: string;
  groupIds: number[];
  /** 这一对能补的性格 + 各自的遗传概率（普通 30% / 60%、学院 100%） */
  natures: Array<{ name: string; chance: number }>;
  grade: string;
  /** 左边那只：学院档 = 学院小窝那只，普通档 = 母本 */
  left: NestPet;
  /** 这一窝的母本（性别折算看它） */
  mother: NestPet;
  /** 期望补格数：概率 × 组数 × 母方性别折算（排序与界面都用它） */
  expectedValue: number;
  /** 子代是目标性别的比例（种公线看出公；按母方物种性别比例，缺数据 5:5） */
  genderShare: number;
  /** 右边：普通档 1 只；学院那只挂 2 个配对方时并排写多只 */
  partners: NestPet[];
  academyParent: NestPet | null;
  expected: NestPairing['expected'];
  /** 这一条在摆位图里的线色（卡片也用同一色） */
  color: string;
  /** 颜色轮回到同一色时用虚线/空心点区分 */
  dashed: boolean;
}

/**
 * 这条建议**产出目标性格的总概率**（各性格互斥：一颗蛋只会有一个性格 → 相加）。
 * 只用于排序；卡片上每个性格单独写各自概率（2026-11-18）。
 */
const viewChance = (view: Pick<PairingView, 'natures'>): number =>
  view.natures.reduce((sum, item) => sum + item.chance, 0);

const percentLabel = (chance: number): string => `${Math.round(chance * 100)}%`;

/**
 * 卡头声音：公、母各取平均后两边再平均，向下取整（2026-11-19 用户口径）。
 * 一对 100 / 97 → (100 + 97) / 2 = 98.5 → 98dB；学院 1:2 时母方两只先平均。
 */
export const averageVoiceOf = (
  pets: readonly { gender: '公' | '母' | '未知'; voiceDb?: number | null }[],
): number | null => {
  const meanOf = (list: number[]): number => list.reduce((sum, value) => sum + value, 0) / list.length;
  const voices = (gender: '公' | '母'): number[] =>
    pets
      .filter(
        (pet) =>
          pet.gender === gender && typeof pet.voiceDb === 'number' && Number.isFinite(pet.voiceDb),
      )
      .map((pet) => pet.voiceDb as number);
  const males = voices('公');
  const females = voices('母');
  if (males.length === 0 || females.length === 0) return null;
  return Math.floor((meanOf(males) + meanOf(females)) / 2);
};

const mergePairings = (pairings: NestPairing[]): PairingView[] => {
  const views: PairingView[] = [];
  const byKey = new Map<string, PairingView>();
  for (const pairing of pairings) {
    // 键用个体身份 + 档位，**不含性格**：同一对精灵补多个性格要并成一行；
    // 同名同内容的两只精灵 key 不同，不会被并；学院那只挂 2 个配对方也只并到它自己这一行。
    const key = viewKeyOf(pairing);
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.partners.some((partner) => partner.key === pairing.partner.key)) {
        existing.partners.push(pairing.partner);
      }
      for (const groupId of pairing.groupIds) {
        if (!existing.groupIds.includes(groupId)) existing.groupIds.push(groupId);
      }
      // 同一对可能对不同性格分别有 60% / 30%：概率按性格各自记，不能一律用档位算
      const existingNature = existing.natures.find((item) => item.name === pairing.natureName);
      if (existingNature) {
        existingNature.chance = Math.max(existingNature.chance, pairing.natureChance);
      } else {
        existing.natures.push({ name: pairing.natureName, chance: pairing.natureChance });
      }
      existing.expectedValue += pairing.expectedValue;
      continue;
    }
    const view: PairingView = {
      key,
      groupIds: [...pairing.groupIds],
      natures: [{ name: pairing.natureName, chance: pairing.natureChance }],
      grade: pairing.grade,
      left: pairing.academyParent ?? pairing.mother,
      mother: pairing.mother,
      expectedValue: pairing.expectedValue,
      genderShare: genderShareOf(speciesByGameId.get(pairing.mother.gameId), '公'),
      partners: [pairing.partner],
      academyParent: pairing.academyParent,
      expected: pairing.expected,
      color: pairingColor(views.length),
      dashed: pairingDashed(views.length),
    };
    byKey.set(key, view);
    views.push(view);
  }
  // 产出目标性格概率高的排前面（同率时按蛋组、性格稳定排序）
  views.sort(
    (a, b) =>
      b.expectedValue - a.expectedValue ||
      viewChance(b) - viewChance(a) ||
      (a.groupIds[0] ?? 0) - (b.groupIds[0] ?? 0) ||
      (a.natures[0]?.name ?? '').localeCompare(b.natures[0]?.name ?? '') ||
      a.key.localeCompare(b.key),
  );
  return views;
};

/**
 * 一行「概率 + 蛋组」：**每个性格一枚「50%固执 ♂」**，后面跟这条线补的蛋组。
 *
 * 2026-11-18 用户口径：不再标「普通 / 学院（绿窝）」档位，也不写「单组 / 双组 / 补 / 种公」；
 * 双组时两个组名直接用原来「双组」的紫色，单组保持原色。性别用图标（GenderMark）。
 */
function PairingHead({
  groupIds,
  natures,
  genderShare,
  voiceDb,
}: Pick<PairingView, 'groupIds' | 'natures' | 'genderShare'> & { voiceDb: number | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="pairing-head">
      {natures.map(({ name, chance }) => (
        <span
          key={name}
          className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-amber-700"
        >
          {percentLabel(chance * genderShare)}
          {name}
          <GenderMark gender="公" />
        </span>
      ))}
      {groupIds.map((groupId) => (
        <span
          key={groupId}
          className={groupIds.length >= 2 ? DUAL_CHIP : CHIP}
          data-testid="pairing-group-chip"
        >
          {groupName(groupId)}
        </span>
      ))}
      {voiceDb !== null ? (
        <span className="text-[10px] leading-none text-slate-500" data-testid="pairing-voice">
          {voiceDb}dB
        </span>
      ) : null}
    </div>
  );
}

/** 空集合：没有传「这个号已收齐哪些组」时，蛋组标签一律保持原蓝色 */
const NO_COLLECTED_GROUPS: ReadonlySet<number> = new Set();

/**
 * 配窝卡里的一只精灵（2026-11-18 用户口径）：跟精灵背包同一张卡的放大版。
 *
 * - 蛋组在编号下方：**这个号已收齐的组显示绿色**，没收齐的保持原来的蓝色；
 * - 体型 / 声音奖牌放在蛋组下方（原来在配对行外面的「大婉」收进卡里）；
 * - 分贝、身高、体重纵向排在性格下方；
 * - 头像 64、名字 11px、盒子位置在卡底，两列并排也看得清。
 */
/** 配窝卡里的一只精灵（补全计划 / 家园共用；家园的背包数据可能缺，所以字段可空） */
export interface PairCardPet {
  key: string;
  gameId: number | null;
  name: string;
  /** 完整名字（含形态）：`name` 只放基础名时用它做 title */
  fullName?: string;
  gender: '公' | '母' | '未知';
  nature: string;
  voiceDb?: number | null;
  medalBody?: string | null;
  heightPercent?: number | null;
  weightPercent?: number | null;
  /** 卡底小字：补全计划是盒子位置，家园是所在小窝 */
  box?: string;
}

export function PairingPetCard({
  pet,
  collectedGroupIds,
  academy = false,
  home = false,
}: {
  pet: PairCardPet;
  collectedGroupIds: ReadonlySet<number>;
  /** 住学院小窝：绿框，和普通窝的卡片区分开 */
  academy?: boolean;
  /** 家园版：压缩到 88px、按性别上淡色底、不写编号（2026-11-19） */
  home?: boolean;
}) {
  const entry = pet.gameId != null ? speciesByGameId.get(pet.gameId) : undefined;
  const groups = (entry?.eggGroups ?? []).filter((groupId) => groupId >= 2 && groupId <= 15);
  const bodyIcon = petBodyMedalIcon(pet.medalBody, pet.weightPercent);
  const voiceIcon = petVoiceMedalIcon(pet.voiceDb);
  const sizeValue = getMyPetsSizeUnit() === 'value';
  const meters = heightMetersOf(entry?.heightSize, pet.heightPercent);
  const kilograms = weightKgOf(entry?.bodySize, pet.weightPercent);
  const heightText =
    sizeValue && meters !== null ? `${meters.toFixed(2)}m` : formatPercent(pet.heightPercent);
  const weightText =
    sizeValue && kilograms !== null ? `${kilograms.toFixed(1)}kg` : formatPercent(pet.weightPercent);

  return (
    <article
      className={`relative min-w-0 overflow-hidden rounded-xl p-1.5 shadow-sm ${
        home ? 'h-[70px]' : 'h-[124px]'
      } ${
        home
          ? pet.gender === '母'
            ? 'bg-pink-50'
            : pet.gender === '公'
              ? 'bg-sky-50'
              : 'bg-slate-50'
          : 'bg-emerald-50/60'
      } ${
        academy
          ? 'border-2 border-emerald-500'
          : home
            ? pet.gender === '母'
              ? 'border border-pink-200'
              : pet.gender === '公'
                ? 'border border-sky-200'
                : 'border border-slate-200'
            : 'border border-emerald-300'
      }`}
      data-testid="breed-pet-card"
    >
      <header className="absolute inset-x-1.5 top-1.5 z-10 grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-0.5 overflow-hidden">
        <div className="flex min-w-0 flex-col items-start gap-px">
          {home ? null : (
            <span className="truncate text-[9px] font-semibold leading-3 text-slate-500">
              No.{entry?.number ?? '—'}
            </span>
          )}
          {groups.map((groupId) => {
            const collected = collectedGroupIds.has(groupId);
            return (
              <span
                key={groupId}
                className={`max-w-full truncate rounded px-1 py-px text-[9px] leading-3 ${
                  collected
                    ? 'bg-emerald-100 font-medium text-emerald-700'
                    : 'bg-sky-100 text-sky-800'
                }`}
                title={collected ? `${groupName(groupId)}（已收齐）` : groupName(groupId)}
              >
                {groupName(groupId)}
              </span>
            );
          })}
          {bodyIcon || voiceIcon ? (
            <span className="mt-0.5 flex items-center gap-1" data-testid="breed-pet-medals">
              {bodyIcon ? (
                <img
                  src={bodyIcon}
                  alt={pet.medalBody ?? ''}
                  title={pet.medalBody ?? undefined}
                  className="h-3.5 w-3.5 drop-shadow-sm"
                />
              ) : null}
              {voiceIcon ? (
                <img
                  src={voiceIcon}
                  alt=""
                  title={`声音 ${pet.voiceDb}dB`}
                  className="h-3.5 w-3.5 drop-shadow-sm"
                />
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col items-end gap-px text-[10px] leading-[13px] text-slate-500">
          <span className="flex min-w-0 items-center justify-end gap-0.5">
            <GenderMark gender={pet.gender} />
            <span
              className="inline-flex max-w-full items-center truncate rounded bg-amber-100 px-1 text-[10px] leading-3 font-medium text-amber-900"
              title={pet.nature}
            >
              {pet.nature}
            </span>
          </span>
          <span className="whitespace-nowrap">
            {pet.voiceDb != null ? `${pet.voiceDb}dB` : '—'}
          </span>
          <span className="whitespace-nowrap">高{heightText}</span>
          <span className="whitespace-nowrap">重{weightText}</span>
        </div>
      </header>
      <div
        className={`absolute left-1/2 flex -translate-x-1/2 items-center justify-center ${
          home ? 'top-[6px] h-11 w-11' : 'top-[10px] h-16 w-16'
        }`}
      >
        <PetAvatar gameId={pet.gameId} name={pet.name} size={home ? 44 : 64} />
      </div>
      <h4
        className={`absolute inset-x-1 truncate text-center font-bold text-slate-900 ${
          home ? 'top-[52px] text-[11px] leading-4' : 'top-[78px] text-[12px] leading-4'
        }`}
        title={pet.fullName ?? pet.name}
      >
        {pet.name}
      </h4>
      {pet.box ? (
        <p
          className="absolute inset-x-1 top-[98px] truncate text-center text-[9px] leading-3 text-slate-400"
          title={pet.box}
        >
          {pet.box}
        </p>
      ) : null}
    </article>
  );
}

/** 母本配窝：一条「未收集母本 × 公」的线（同种时同时补种公，记双收益） */
function MotherPairingCard({
  pairing,
  collectedGroupIds,
}: {
  pairing: MotherNestPairing;
  collectedGroupIds: ReadonlySet<number>;
}) {
  /** 每个推荐性格单独算「出母 × 拿到这个性格」：6~30 个百分点的独立目标 */
  const natureChances = pairing.recommendedNatures
    .map((nature) => ({
      nature,
      chance:
        pairing.femaleChance *
        recommendedNatureChance(pairing.mother.nature, pairing.father.nature, [nature]),
    }))
    .filter((item) => item.chance > 0);
  const voiceDb = averageVoiceOf([pairing.mother, pairing.father]);
  return (
    <li
      className="rounded-xl border-l-4 border-amber-400 bg-amber-50/60 px-2 py-2"
      data-testid="mother-pairing"
    >
      <div className="flex flex-wrap items-center gap-1">
        {natureChances.map(({ nature, chance }) => (
          <span
            key={nature}
            className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-amber-700"
          >
            {percentLabel(chance)}
            {nature}
            <GenderMark gender="母" />
          </span>
        ))}
        {pairing.groupIds.map((groupId) => (
          <span key={groupId} className={CHIP}>
            {groupName(groupId)}
          </span>
        ))}
        {voiceDb !== null ? (
          <span className="text-[10px] leading-none text-slate-500">{voiceDb}dB</span>
        ) : null}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <PairingPetCard pet={pairing.mother} collectedGroupIds={collectedGroupIds} />
        <PairingPetCard pet={pairing.father} collectedGroupIds={collectedGroupIds} />
      </div>
    </li>
  );
}

/** 跨号母本建议：源号最高概率的一对 → 传蛋过来；并进底部「跨号补缺」待办 */
function MotherTaskCard({
  task,
  collectedGroupIds,
}: {
  task: MotherNestTask;
  collectedGroupIds: ReadonlySet<number>;
}) {
  const natureChances = task.recommendedNatures
    .map((nature) => ({
      nature,
      chance:
        task.femaleChance *
        recommendedNatureChance(task.mother.nature, task.father.nature, [nature]),
    }))
    .filter((item) => item.chance > 0);
  const voiceDb = averageVoiceOf([task.mother, task.father]);

  return (
    <li
      className="rounded-xl border border-dashed border-sky-200 bg-sky-50/60 px-2.5 py-2"
      data-testid="mother-task"
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white">
          跨号 · 传蛋
        </span>
        {natureChances.map(({ nature, chance }) => (
          <span
            key={nature}
            className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-amber-700"
          >
            {percentLabel(chance)}
            {nature}
            <GenderMark gender="母" />
          </span>
        ))}
        {task.groupIds.map((groupId) => (
          <span key={groupId} className={CHIP}>
            {groupName(groupId)}
          </span>
        ))}
        {voiceDb !== null ? (
          <span className="text-[10px] leading-none text-slate-500">{voiceDb}dB</span>
        ) : null}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <PairingPetCard pet={task.mother} collectedGroupIds={collectedGroupIds} />
        <PairingPetCard pet={task.father} collectedGroupIds={collectedGroupIds} />
      </div>
      <p className="mt-1 text-center text-[11px] font-semibold text-sky-700" data-testid="mother-task-flow">
        {task.sourceAccount} → {task.account}
      </p>
      <button
        type="button"
        onClick={() =>
          addStudTransferTask({
            kind: 'mother',
            targetAccount: task.account,
            sourceAccount: task.sourceAccount,
            eggGameId: task.eggGameId,
            motherGameId: task.mother.gameId,
            motherName: task.mother.name,
            motherNature: task.mother.nature,
            fatherGameId: task.father.gameId,
            fatherName: task.father.name,
            fatherNature: task.father.nature,
            natureName: task.recommendedNatures.join('、') || '不限性格',
            grade: task.grade,
            groupIds: task.groupIds,
            chance: task.chance,
            femaleChance: task.femaleChance,
            sameSpecies: task.sameSpecies,
          })
        }
        data-testid="mother-task-add"
        className="mt-1.5 rounded-lg border border-sky-200 bg-white px-2 py-1 text-[11px] font-medium text-sky-700"
      >
        加入传蛋待办
      </button>
    </li>
  );
}

/** 配对卡片：一条配窝建议（左侧色条 + 圆点 = 摆位图里那条线的颜色，便于对号入座） */
function PairingCard({
  view,
  testId,
  receivers,
  collectedGroupIds,
}: {
  view: PairingView;
  testId: string;
  /** 这一格还有哪些号在等蛋（缺口分工算出来的收蛋方） */
  receivers: string[];
  /** 本号已经收齐的蛋组（卡里标绿） */
  collectedGroupIds: ReadonlySet<number>;
}) {
  const cards = [view.left, ...view.partners];
  const voiceDb = averageVoiceOf(cards);
  return (
    <li
      className="rounded-xl border-l-4 bg-slate-50 px-2 py-2"
      style={{ borderLeftColor: view.color }}
      data-testid={testId}
    >
      <div className="flex items-start gap-1.5">
        <span
          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
          style={
            view.dashed
              ? { border: `2px solid ${view.color}` } // 与虚线一一对应
              : { backgroundColor: view.color }
          }
          aria-hidden="true"
        />
        <PairingHead
          groupIds={view.groupIds}
          natures={view.natures}
          genderShare={view.genderShare}
          voiceDb={voiceDb}
        />
      </div>
      {/* 一对 = 两张精灵背包卡（学院 1:2 时三张）；卡片里自带盒子位置，外面不再重复 */}
      <div
        className="mt-1.5 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
      >
        {cards.map((pet, index) => (
          <PairingPetCard
            key={`${pet.key}-${index}`}
            pet={pet}
            collectedGroupIds={collectedGroupIds}
          />
        ))}
      </div>
      {/* 谁传给谁（2026-11-18）：放在两张精灵卡下方正中，不埋在卡片底部 */}
      {receivers.length > 0 ? (
        <p
          className="mt-1 text-center text-[11px] font-medium text-sky-700"
          data-testid="breed-receivers"
        >
          {view.mother.account} → {receivers.slice(0, 3).join('、')}
          {receivers.length > 3 ? ` 等 ${receivers.length} 个号` : ''}
        </p>
      ) : null}
    </li>
  );
}

/**
 * 「一键配窝」卡片：按账号给出**哪只进哪个窝、和谁配、小窝怎么摆**。
 * 数据来自 `buildNestPlans`（第一期：可配建议）。候选配对默认收起，用户可自行替换。
 *
 * `emptyNote`：没有可排方案时的提示语。目标已全收齐时由页面改写成「已全部收集」，
 * 不再让用户去覆盖度找不存在的缺口（2026-10-24）。
 *
 * `transferTasks`：种公阵列里手动「加入配窝建议」的跨号补种公任务（2026-11-03），
 * 和目标号的方案一起展示——本质上是给自己补种公。
 */
export function NestPlanCard({
  plans,
  emptyNote,
  transferTasks = [],
  onRemoveTransferTask,
  gapsByAccount,
  collectedGroupIdsByAccount,
  motherSuggestions,
}: {
  plans: NestPlan[];
  emptyNote?: string;
  transferTasks?: StudTransferTask[];
  onRemoveTransferTask?: (id: string) => void;
  /** 每个号自己还差几个种公目标（按号各算，2026-11-18） */
  gapsByAccount?: ReadonlyMap<string, number>;
  /** 每个号已经收齐的蛋组（配窝卡里标绿；没传就全是原来的蓝色） */
  collectedGroupIdsByAccount?: ReadonlyMap<string, ReadonlySet<number>>;
  /** 母本配窝建议（2026-11-18）：本号内母本线 + 跨号传蛋；按账号索引 */
  motherSuggestions?: ReadonlyMap<string, MotherNestAccount>;
}) {
  const mode = useTargetMode();
  /** 当前看哪个号（多账号滑条切换；默认第一个有内容的号） */
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const entries = plans.map((plan) => ({ plan, views: mergePairings(plan.pairings) }));
  /** 这个号有几条母本建议（本号内 + 跨号） */
  const motherCountOf = (account: string): number => {
    const suggestion = motherSuggestions?.get(account);
    return (suggestion?.pairings.length ?? 0) + (suggestion?.tasks.length ?? 0);
  };
  /** 有内容的号才进滑条：出窝的、等蛋的、还有缺口的、或者有母本建议的 */
  const visible = entries.filter(
    (entry) =>
      entry.views.length > 0 ||
      entry.plan.unfilled.length > 0 ||
      entry.plan.delegated.length > 0 ||
      motherCountOf(entry.plan.account) > 0,
  );
  const hasContent = visible.length > 0;

  /** 每一格还有哪些号在等蛋：来自别的号的 delegated 清单（2026-11-18 多账号） */
  const receiversByCell = new Map<string, string[]>();
  for (const plan of plans) {
    for (const item of plan.delegated) {
      const key = `${item.groupId}|${item.natureName}|${item.grade}`;
      const list = receiversByCell.get(key) ?? [];
      if (!list.includes(plan.account)) list.push(plan.account);
      receiversByCell.set(key, list);
    }
  }
  const receiversOf = (view: PairingView): string[] => {
    const set = new Set<string>();
    for (const groupId of view.groupIds) {
      for (const nature of view.natures) {
        const key = `${groupId}|${nature.name}|${view.grade}`;
        for (const account of receiversByCell.get(key) ?? []) set.add(account);
      }
    }
    return [...set];
  };

  if (!hasContent && transferTasks.length === 0) {
    return (
      <p className="mt-1 text-sm text-slate-400" data-testid="breed-empty">
        {emptyNote ?? '当前没有能排的配窝方案——先到「覆盖度」挑要补的缺口，或缺的配对方/母本还没到位。'}
      </p>
    );
  }
  // 默认看「要出的窝最多」的那个号，而不是按账号名排第一个（多号时第一个往往是空壳）
  const defaultAccount = visible.reduce(
    (best, entry) =>
      entry.views.length + motherCountOf(entry.plan.account) >
      best.views.length + motherCountOf(best.plan.account)
        ? entry
        : best,
    visible[0],
  );
  const active =
    visible.find((entry) => entry.plan.account === activeAccount) ?? defaultAccount;
  /** 当前号的母本配窝：pairings = 本号内要占窝的线；tasks = 跨号传蛋建议 */
  const mother = active ? motherSuggestions?.get(active.plan.account) ?? null : null;
  const motherNests = mother?.nestsUsed ?? 0;
  const styleByKey = active
    ? new Map(active.views.map((view) => [view.key, { color: view.color, dashed: view.dashed }]))
    : new Map<string, { color: string; dashed: boolean }>();

  return (
    <div className="mt-1">
      {visible.length > 1 ? (
        <div
          className="-mx-1 mb-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1"
          data-testid="breed-account-tabs"
        >
          {visible.map((entry) => {
            const selected = entry.plan.account === active?.plan.account;
            return (
              <button
                key={entry.plan.account}
                type="button"
                onClick={() => setActiveAccount(entry.plan.account)}
                data-testid="breed-account-tab"
                aria-pressed={selected}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                }`}
              >
                {entry.plan.account}
                <span className={`ml-1 text-[10px] ${selected ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {entry.views.length > 0 ? `${entry.views.length} 对` : '待补'}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {active ? (
        <div data-testid="breed-account">
          <h3 className="mb-1 text-sm font-medium text-slate-700" data-testid="breed-account-name">
            {active.plan.account} · 用 {active.plan.nestsUsed + motherNests}/{active.plan.nestsTotal} 个窝
            {motherNests > 0 ? (
              <span className="ml-1 text-[10px] font-normal text-amber-700">
                种公 {active.plan.nestsUsed} + 母本 {motherNests}
              </span>
            ) : null}
            {gapsByAccount?.get(active.plan.account) != null ? (
              <span className="ml-1 text-xs font-normal text-slate-500">
                · 差 <b className="text-rose-600">{gapsByAccount.get(active.plan.account)}</b> 个种公目标
              </span>
            ) : null}
          </h3>
          <NestLayoutMap plan={active.plan} styleByKey={styleByKey} motherPairings={mother?.pairings} />
          {active.views.length === 0 && (mother?.pairings.length ?? 0) === 0 ? (
            <p className="mt-1 text-xs text-slate-400" data-testid="breed-idle">
              这个号不用出窝：缺口由别的号补，孵好再把蛋传过来。
            </p>
          ) : null}
          {active.views.length > 0 ? (
            <ul className="mt-1.5 space-y-1.5" data-testid="breed-list">
              {active.views.map((view) => (
                <PairingCard
                  key={view.key}
                  view={view}
                  testId="breed-suggestion"
                  receivers={receiversOf(view)}
                  collectedGroupIds={
                    collectedGroupIdsByAccount?.get(active.plan.account) ?? NO_COLLECTED_GROUPS
                  }
                />
              ))}
            </ul>
          ) : null}

          {mother && (mother.pairings.length > 0 || mother.tasks.length > 0) ? (
            <div className="mt-2 border-t border-dashed border-slate-200 pt-2" data-testid="mother-nest">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-semibold text-slate-700">母本配窝</h4>
                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  本号未收集 {mother.gapCount} · 可补 {mother.pairings.length + mother.tasks.length}
                </span>
                {motherNests > 0 ? (
                  <span className="text-[10px] text-slate-400">本号内线占 {motherNests} 个窝</span>
                ) : null}
              </div>
              {mother.pairings.length > 0 ? (
                <ul className="mt-1.5 space-y-1.5" data-testid="mother-pairings">
                  {mother.pairings.map((pairing) => (
                    <MotherPairingCard
                      key={`${pairing.eggGameId}-${pairing.mother.key}-${pairing.father.key}`}
                      pairing={pairing}
                      collectedGroupIds={
                        collectedGroupIdsByAccount?.get(active.plan.account) ?? NO_COLLECTED_GROUPS
                      }
                    />
                  ))}
                </ul>
              ) : null}
              {mother.tasks.length > 0 ? (
                <ul className="mt-1.5 space-y-1.5" data-testid="mother-tasks">
                  {mother.tasks.map((task) => (
                    <MotherTaskCard
                      key={`${task.eggGameId}-${task.sourceAccount}`}
                      task={task}
                      collectedGroupIds={
                        collectedGroupIdsByAccount?.get(active.plan.account) ?? NO_COLLECTED_GROUPS
                      }
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {active.plan.delegated.length > 0 ? (
            <ul className="mt-1.5 space-y-1" data-testid="breed-delegated">
              {active.plan.delegated.map((item) => (
                <li
                  key={`${item.groupId}-${item.natureName}-${item.grade}-${item.byAccount}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-sky-200 bg-sky-50/60 px-2.5 py-1.5 text-[11px] text-sky-800"
                >
                  <span className="min-w-0 truncate font-medium">
                    {groupName(item.groupId)} · {item.natureName} · {gradeLabel(item.grade, mode)}
                  </span>
                  <span className="shrink-0">由 {item.byAccount} 出蛋，孵好传过来</span>
                </li>
              ))}
            </ul>
          ) : null}

          {active.plan.unfilled.length > 0 ? (
            <ul className="mt-1.5 space-y-1" data-testid="breed-unfilled">
              {active.plan.unfilled.map((item) => (
                <li
                  key={`${item.groupId}-${item.natureName}-${item.grade}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-[11px] ${
                    item.reason === 'male-scarce'
                      ? 'border-rose-200 bg-rose-50/60 text-rose-700'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">
                    {groupName(item.groupId)} · {item.natureName} · {gradeLabel(item.grade, mode)}
                  </span>
                  <span className="shrink-0">{UNFILLED_REASON[item.reason]}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {active.plan.blockedLinks.length > 0 ? (
            <p className="mt-1 text-[11px] text-rose-600" data-testid="breed-blocked">
              注意：有 {active.plan.blockedLinks.length} 条连线会产出非目标蛋
            </p>
          ) : null}
        </div>
      ) : null}

      {transferTasks.length > 0 ? (
        <TransferTaskList tasks={transferTasks} onRemove={onRemoveTransferTask} />
      ) : null}
    </div>
  );
}

function TransferTaskList({
  tasks,
  onRemove,
}: {
  tasks: StudTransferTask[];
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="mt-3" data-testid="breed-transfer-tasks">
      <h3 className="mb-1 text-xs font-medium text-slate-400">跨号补缺（种公 / 母本）</h3>
      <ul className="space-y-1">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-start gap-2 rounded-xl bg-sky-50 px-2.5 py-2"
            data-testid="breed-transfer-task"
          >
            <div className="min-w-0 flex-1">
              {task.kind === 'mother' ? (
                <p className="text-[11px] leading-relaxed text-slate-700">
                  <span className="font-medium text-sky-700">{task.targetAccount}</span>
                  <span className="mx-1 text-slate-400">←</span>
                  <span className="font-medium">{task.sourceAccount}</span>
                  <span className="ml-1 text-slate-400">母</span>
                  {speciesDisplayName(speciesByGameId.get(task.motherGameId), task.motherName)}
                  <span className="text-slate-400">({task.motherNature})</span>
                  <span className="mx-1 text-slate-400">×</span>
                  <span className="text-slate-400">公</span>
                  {speciesDisplayName(speciesByGameId.get(task.fatherGameId), task.fatherName)}
                  <span className="text-slate-400">({task.fatherNature})</span>
                  <span className="ml-1 text-[9px] text-sky-700">
                    对性母 {Math.round(task.chance * 100)}%
                  </span>
                </p>
              ) : (
              <p className="text-[11px] leading-relaxed text-slate-700">
                <span className="font-medium text-sky-700">{task.targetAccount}</span>
                <span className="mx-1 text-slate-400">←</span>
                <span className="font-medium">{task.sourceAccount}</span>
                <span className="ml-1 text-slate-400">母</span>
                {speciesDisplayName(speciesByGameId.get(task.motherGameId), task.motherName)}
                <span className="text-slate-400">({task.motherNature})</span>
                <span className="mx-1 text-slate-400">×</span>
                <span className="text-slate-400">公</span>
                {speciesDisplayName(speciesByGameId.get(task.fatherGameId), task.fatherName)}
                <span className="text-slate-400">({task.fatherNature})</span>
                <span className="ml-1 text-[9px] text-sky-700">
                  {Math.round(task.chance * 100)}%
                </span>
              </p>
              )}
              <p className="mt-0.5 text-[10px] text-slate-500">
                {task.kind === 'mother' ? '孵蛋传过来补母本：' : '孵蛋传过来补：'}
                {task.kind === 'mother'
                  ? task.groupIds.map((groupId) => groupName(groupId)).join('、')
                  : task.groupIds.map((groupId) => `${groupName(groupId)}·${task.natureName}`).join('、')}
              </p>
            </div>
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(task.id)}
                aria-label={`移除「${task.sourceAccount} 补 ${task.natureName}」`}
                data-testid="breed-transfer-remove"
                className="shrink-0 rounded px-1 text-[11px] leading-none text-slate-400"
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
