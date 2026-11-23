import type { OwnedPet } from '../domain/types';

/**
 * 仿真背包的分页 / 落位（2026-11-23 用户口径）。
 *
 * 游戏里每盒 6 × 5 = 30 格，`slotOrder` 就是格子序号。仿真背包要能照着
 * 真实背包找精灵，所以**一页 = 一个盒子**，宠物按 `slotOrder` 落格，
 * 空位留着；没有盒位的「盒外精灵」单独排在最后。
 */

export const SIM_BAG_COLUMNS = 6;
export const SIM_BAG_ROWS = 5;
export const SIM_BAG_SLOTS = SIM_BAG_COLUMNS * SIM_BAG_ROWS;

export interface SimBackpackSlot {
  /** 1-based 格号，和游戏里的 slotOrder 一致。 */
  slot: number;
  pet: OwnedPet | null;
}

export interface SimBackpackPage {
  /** 账号 + 盒名 + 续页序号，翻页时用作 key。 */
  key: string;
  account: string;
  /** 盒名（盒子01）/ 盒外精灵 / 盒外精灵 2。 */
  label: string;
  kind: 'box' | 'offbox';
  /** 盒子序号；盒外精灵为 null。 */
  boxNumber: number | null;
  slots: SimBackpackSlot[];
  filled: number;
}

export interface SimBackpackAccount {
  account: string;
  pages: SimBackpackPage[];
}

const BOX_NUMBER_RE = /^盒子\s*(\d+)/;

function isOffbox(pet: OwnedPet): boolean {
  return !pet.boxGroup || pet.boxGroup === '盒外精灵';
}

function boxNumberOf(label: string, sample: OwnedPet | undefined): number {
  if (sample?.boxNumber != null && Number.isFinite(sample.boxNumber)) {
    return sample.boxNumber;
  }
  const matched = BOX_NUMBER_RE.exec(label);
  return matched ? Number(matched[1]) : Number.MAX_SAFE_INTEGER;
}

function emptySlots(): SimBackpackSlot[] {
  return Array.from({ length: SIM_BAG_SLOTS }, (_, index) => ({
    slot: index + 1,
    pet: null,
  }));
}

function createPage(
  account: string,
  label: string,
  kind: SimBackpackPage['kind'],
  boxNumber: number | null,
  part: number,
): SimBackpackPage {
  return {
    key: `${account}\u0000${label}\u0000${part}`,
    account,
    label,
    kind,
    boxNumber,
    slots: emptySlots(),
    filled: 0,
  };
}

/**
 * 先按真实格号落位；格号缺失 / 越界 / 重复时退回第一个空格，
 * 保证不会丢精灵。返回这一页放不下的剩余精灵（正常数据不会出现）。
 */
function placePets(page: SimBackpackPage, pets: OwnedPet[]): OwnedPet[] {
  const overflow: OwnedPet[] = [];
  for (const pet of pets) {
    const order = pet.slotOrder;
    const index = order != null && Number.isInteger(order) && order >= 1 && order <= SIM_BAG_SLOTS
      ? order - 1
      : -1;
    if (index >= 0 && !page.slots[index].pet) {
      page.slots[index].pet = pet;
    } else {
      overflow.push(pet);
    }
  }

  const remaining: OwnedPet[] = [];
  for (const pet of overflow) {
    const index = page.slots.findIndex((slot) => !slot.pet);
    if (index < 0) {
      remaining.push(pet);
      continue;
    }
    page.slots[index].pet = pet;
  }
  return remaining;
}

function finishPage(page: SimBackpackPage): SimBackpackPage {
  page.filled = page.slots.reduce((count, slot) => count + (slot.pet ? 1 : 0), 0);
  return page;
}

function buildBoxPages(
  account: string,
  label: string,
  boxNumber: number,
  pets: OwnedPet[],
): SimBackpackPage[] {
  // 按格号升序落位；没有格号的排在后面，再按第一个空格顺序补
  let pending = [...pets].sort((left, right) => {
    const a = left.slotOrder ?? Number.MAX_SAFE_INTEGER;
    const b = right.slotOrder ?? Number.MAX_SAFE_INTEGER;
    return a - b;
  });
  const pages: SimBackpackPage[] = [];
  let part = 0;
  while (pending.length > 0) {
    const page = createPage(account, part === 0 ? label : `${label} ${part + 1}`, 'box', boxNumber, part);
    pending = placePets(page, pending);
    pages.push(finishPage(page));
    part += 1;
  }
  return pages;
}

function buildOffboxPages(account: string, pets: OwnedPet[]): SimBackpackPage[] {
  const pages: SimBackpackPage[] = [];
  for (let start = 0; start < pets.length; start += SIM_BAG_SLOTS) {
    const part = pages.length;
    const page = createPage(
      account,
      part === 0 ? '盒外精灵' : `盒外精灵 ${part + 1}`,
      'offbox',
      null,
      part,
    );
    // 盒外精灵没有真实格号：按数据顺序填 1..30
    placePets(page, pets.slice(start, start + SIM_BAG_SLOTS));
    pages.push(finishPage(page));
  }
  return pages;
}

/**
 * 按账号顺序生成仿真背包。只保留传入的账号（通常是右栏当前选中的账号）；
 * 每个账号的页顺序 = 盒子序号升序，盒外精灵排最后。
 */
export function buildSimBackpack(
  pets: readonly OwnedPet[],
  accounts: readonly string[],
): SimBackpackAccount[] {
  const byAccount = new Map<string, OwnedPet[]>();
  for (const account of accounts) byAccount.set(account, []);
  for (const pet of pets) {
    byAccount.get(pet.account)?.push(pet);
  }

  return accounts.map((account) => {
    const boxes = new Map<string, OwnedPet[]>();
    const offbox: OwnedPet[] = [];

    for (const pet of byAccount.get(account) ?? []) {
      if (isOffbox(pet)) {
        offbox.push(pet);
        continue;
      }
      const label = pet.boxGroup!.trim();
      const list = boxes.get(label);
      if (list) list.push(pet);
      else boxes.set(label, [pet]);
    }

    const boxPages = [...boxes.entries()]
      .map(([label, list]) => ({
        label,
        boxNumber: boxNumberOf(label, list[0]),
        pets: list,
      }))
      .sort((left, right) => left.boxNumber - right.boxNumber || left.label.localeCompare(right.label))
      .flatMap(({ label, boxNumber, pets: boxPets }) => buildBoxPages(account, label, boxNumber, boxPets));

    return { account, pages: [...boxPages, ...buildOffboxPages(account, offbox)] };
  });
}
