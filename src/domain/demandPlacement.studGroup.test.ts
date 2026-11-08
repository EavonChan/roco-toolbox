import { describe, expect, test } from 'vitest';
import { species } from '../data/catalog';
import { studPlacementOptions } from './demandPlacement';
import type { AccountSnapshot } from './parseBackup';
import type { OwnedPet } from './types';
import type { DemandCriteria } from '../shared/collectionGroups';

/**
 * 种公单的推荐配窝：公本只要和**母本**同蛋组就能配（2026-11-01 用户反馈）。
 *
 * 用例是线上真实组合：母 火豆丁（巨灵组 + 拟人组）、公 矮脚爬爬（巨灵组 + 昆虫组），
 * 两人在巨灵组同组，后代是母本 火豆丁（拟人组），所以**拟人组**的种公单完全配得上。
 * 之前的实现按「需求的蛋组」筛公本（矮脚爬爬不在拟人组）→ 推荐列表空掉。
 */
const pet = (over: Partial<OwnedPet>): OwnedPet => ({
  gameId: 0,
  name: '',
  gender: '母',
  nature: '',
  voiceDb: 100,
  medalBody: '大块头',
  weightPercent: 90,
  heightPercent: 90,
  isShiny: false,
  account: '账号A',
  ...over,
});

const snapshot: AccountSnapshot = {
  accountName: '账号A',
  gameId: 1,
  accountKey: 'uid:1',
  exportedAt: '2026-11-01T00:00:00.000Z',
  importedAt: '2026-11-01T00:00:00.000Z',
  pets: [
    pet({ gameId: 3178, name: '矮脚爬爬', gender: '公', nature: '平和', captureId: 'cap_1' }),
    pet({ gameId: 3754, name: '火豆丁', gender: '母', nature: '平和', captureId: 'cap_2' }),
  ],
  eggs: [],
};

const studDemand = (groupId: number): DemandCriteria & {
  groupId: string;
  demanderAccountId: string;
  claimedAt: number;
} => ({
  groupId: 'g1',
  demanderAccountId: 'A',
  claimedAt: 1,
  eggGameId: -groupId,
  nature: '平和',
  gender: '公',
  body: '',
  voice: '',
});

describe('种公单推荐配窝：公本按母本的蛋组筛', () => {
  test('拟人组：母 火豆丁 + 公 矮脚爬爬（巨灵组同组）能出现', () => {
    const options = studPlacementOptions([snapshot], studDemand(9), species);

    expect(options).toHaveLength(1);
    expect(options[0].name).toBe('火豆丁');
    expect(options[0].motherPet.pet.name).toBe('火豆丁');
    expect(options[0].malePet.pet.name).toBe('矮脚爬爬');
  });

  test('巨灵组：同一对也能出现（母本同时属于两个组）', () => {
    const options = studPlacementOptions([snapshot], studDemand(2), species);

    expect(options).toHaveLength(1);
    expect(options[0].name).toBe('火豆丁');
  });

  test('同一档概率的「母本 × 种公」全部列出，不再只留前 5 条', () => {
    // 线上真实组合：3 只拟人组平和母（火豆丁 / 可爱猿 / 白发懒人）× 6 只巨灵组平和公
    const mothers = [
      [3754, '火豆丁'],
      [3083, '可爱猿'],
      [3049, '白发懒人'],
    ].map(([gameId, name], index) =>
      pet({ gameId: gameId as number, name: name as string, gender: '母', nature: '平和', captureId: `m${index}` }),
    );
    const fathers = [
      [3178, '矮脚爬爬'],
      [3003, '火花'],
      [3014, '阿米亚特'],
      [3016, '罗隐'],
      [3032, '焰火'],
      [3062, '小独角兽'],
    ].map(([gameId, name], index) =>
      pet({ gameId: gameId as number, name: name as string, gender: '公', nature: '平和', captureId: `f${index}` }),
    );
    const both: AccountSnapshot = { ...snapshot, pets: [...mothers, ...fathers] };

    const options = studPlacementOptions([both], studDemand(9), species);

    expect(options).toHaveLength(mothers.length * fathers.length);
    const names = options.map(
      (option) => `${option.motherPet.pet.name}×${option.malePet.pet.name}`,
    );
    expect(names).toContain('火豆丁×矮脚爬爬');
  });

  test('和母本毫无共同蛋组的公仍然排不上', () => {
    const lonely: AccountSnapshot = {
      ...snapshot,
      pets: [
        pet({ gameId: 3178, name: '矮脚爬爬', gender: '公', nature: '平和', captureId: 'cap_1' }),
        pet({ gameId: 3754, name: '火豆丁', gender: '母', nature: '平和', captureId: 'cap_2' }),
        // 迪莫只有超能组（1），和火豆丁的巨灵组 / 拟人组都不同
        pet({ gameId: 3004, name: '迪莫', gender: '公', nature: '平和', captureId: 'cap_3' }),
      ],
    };
    const options = studPlacementOptions([lonely], studDemand(9), species);

    expect(options).toHaveLength(1);
    expect(options[0].malePet.pet.name).toBe('矮脚爬爬');
  });
});
