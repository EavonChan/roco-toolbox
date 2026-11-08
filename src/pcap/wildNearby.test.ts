import { describe, expect, test } from 'vitest';
import { decorateWildPet, sortNearby, withDistance, type WildPet } from './wildNearby';
import { parseWildEntities, parseOwnedPetDetails, parseSeasonEncounterUnits, type WildEntityRaw } from '../pcap-decoder/tools/pcap-json-app/src/core';

/** 真实野外抓包 capture-1793891528222.pcap 里出现过的实体（脱敏：只保留协议字段）。 */
const HUSKY: WildEntityRaw = {
  cfgId: 10096, actorId: 6, uniqueId: 12011305, level: 37,
  height: 78, weight: 15513, voiceDb: -99, mutation: 0, glassType: 0, glassValue: 0,
  pos: { x: 429462, y: 648300, z: 1088 },
};
const IBERRY: WildEntityRaw = {
  cfgId: 10065, actorId: 6, uniqueId: 260360003, level: 40,
  height: 61, weight: 4126, voiceDb: -99, mutation: 0, glassType: 0, glassValue: 0,
  pos: { x: 431992, y: 641328, z: 421 },
};

describe('野外实体补全', () => {
  test('cfgId 映射到种族名与体重区间，算出百分位', () => {
    const pet = decorateWildPet(HUSKY);
    expect(pet.petId).toBe(3070);
    expect(pet.name).toBe('护主犬');
    // 15513g 落在 13.678~17.422kg 区间的中段
    expect(pet.weightPct).toBeGreaterThan(45);
    expect(pet.weightPct).toBeLessThan(55);
  });

  test('声音 -99dB 只算牌子，不到 ±100 不触发主动提醒', () => {
    const pet = decorateWildPet(IBERRY);
    expect(pet.kinds).toEqual(['low']);
    expect(pet.rare).toBe(true);
    expect(pet.alertReason).toBeNull();
  });

  test('±100dB 才触发主动提醒', () => {
    const pet = decorateWildPet({ ...IBERRY, voiceDb: -100 });
    expect(pet.alertReason).toBe('-100dB 粗嗓门');
  });

  test('宠物记录回填性格与性别：7 = 天真，1 = 公', () => {
    const pet = decorateWildPet(HUSKY, { natureId: 7, genderId: 1 });
    expect(pet.natureId).toBe(7);
    expect(pet.nature).toBe('天真');
    expect(pet.gender).toBe('公');
  });

  test('没有宠物记录时性格性别为空，不伪造', () => {
    const pet = decorateWildPet(HUSKY);
    expect(pet.natureId).toBeNull();
    expect(pet.nature).toBe('');
    expect(pet.gender).toBe('');
  });

  test('未知 cfgId 不伪造名称', () => {
    const pet = decorateWildPet({ ...HUSKY, cfgId: 19999 });
    expect(pet.petId).toBeNull();
    expect(pet.name).toBe('未知精灵 19999');
    expect(pet.weightPct).toBeNull();
  });

  test('去重键优先 uniqueId', () => {
    expect(decorateWildPet(HUSKY).key).toBe('12011305');
  });
});

describe('特殊场景实体（蛋包蛋）', () => {
  /** 330 里的特殊实体：cfgId 29401、41 级、不带身高体重。 */
  const SPECIAL: WildEntityRaw = {
    cfgId: 29401, actorId: 6, uniqueId: 292001600, level: 41,
    height: 0, weight: 0, voiceDb: 0, mutation: 0, glassType: 0, glassValue: 0,
    pos: { x: 459403, y: 553946, z: 20134 },
  };

  test('cfgId 29401 识别为蛋包蛋，没有身高体重也不出体型牌', () => {
    const pet = decorateWildPet(SPECIAL);
    expect(pet.petId).toBe(3808);
    expect(pet.name).toBe('蛋包蛋');
    expect(pet.weightPct).toBeNull();
    expect(pet.kinds).toEqual([]);
    expect(pet.rare).toBe(false);
  });

  test('解析 330 时不再因为 cfgId 不在 10000-19999 丢掉蛋包蛋', () => {
    expect(parseWildEntities(specialEntityFrame())).toEqual([SPECIAL]);
  });
});

const varint = (value: number): number[] => {
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0x7f) {
    bytes.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 128);
  }
  bytes.push(rest & 0x7f);
  return bytes;
};
const tag = (field: number, wire: number) => varint((field << 3) | wire);
const scalar = (field: number, value: number) => [...tag(field, 0), ...varint(value)];
const message = (field: number, body: number[]) => [...tag(field, 2), ...varint(body.length), ...body];

/** 拼一个 330 实体帧：顶层 field 7 → actor(field 11) → identity(field 1) / pet(field 3)。 */
function specialEntityFrame(): Uint8Array {
  const pos = [
    ...scalar(1, 459403), ...scalar(2, 553946), ...scalar(3, 20134),
  ];
  const identity = [
    ...scalar(1, 6),
    ...message(8, message(1, pos)),
    ...scalar(11, 41),
  ];
  const pet = [
    ...scalar(1, 29401),
    ...scalar(17, 292001600),
  ];
  const actor = [...message(1, identity), ...message(3, pet)];
  return new Uint8Array(message(7, message(11, actor)));
}

describe('赛季奇遇战（龙棋士）', () => {
  test('战斗帧 4886/4890 里能直接读到守卫的真实性格', () => {
    const [unit] = parseSeasonEncounterUnits(encounterFrame(4));
    expect(unit).toMatchObject({
      formId: 1646, guardName: '龙棋士', unitId: 9006, level: 41,
      natureId: 4, natureConfirmed: true, genderId: 1, height: 32, weight: 1900, bloodId: 24,
      voiceDb: 0,
    });
  });

  test('性格占位 30 时仍返回单位，但标记为未确认', () => {
    const unit = parseSeasonEncounterUnits(encounterFrame(30))[0];
    expect(unit).toBeTruthy();
    expect(unit.natureConfirmed).toBe(false);
    expect(unit.level).toBe(41);
  });

  test('普通对战（非奇遇形态）不解析', () => {
    expect(parseSeasonEncounterUnits(encounterFrame(4, 3572))).toEqual([]);
  });

  test('秒杀/奖励登场：战斗帧（5107/4890）里与守卫同数据的记录可解析为宠物记录', () => {
    // 2026-11-08 秒杀+成功捕捉局实测：道具秒杀守卫后，奖励精灵（与守卫同个体数据）
    // 最早出现在 5107/4890 战斗帧；抓到后 579 才有完整捕获记录，没抓的局 579 为空。
    // extractPcap 靠这两个帧把守卫的临时 unitId 回填成真实 petId，
    // 名字与身高体重百分比在 579 之前就能显示。
    const rewardRecord = [
      ...scalar(7, 23), ...scalar(8, 1), ...scalar(10, 42),
      ...scalar(15, 3381), ...scalar(26, 218), ...scalar(27, 660812),
      ...scalar(47, 24),
    ];
    const battleFrame = new Uint8Array(message(1, message(2, message(4, rewardRecord))));
    expect(parseOwnedPetDetails(battleFrame)).toEqual([
      { petId: 3381, level: 42, height: 218, weight: 660812, natureId: 23, genderId: 1, bloodId: 24, voiceDb: 0 },
    ]);
  });
});

/** 拼一个战斗帧（4886/4890）里的奇遇守卫记录：record 带形态、名字、性格等。 */
function encounterFrame(natureId: number, formId = 1646): Uint8Array {
  const record = [
    ...scalar(2, formId),
    ...message(3, [...new TextEncoder().encode('龙棋士')]),
    ...scalar(7, natureId), ...scalar(8, 1), ...scalar(10, 41),
    ...scalar(15, 9006), ...scalar(26, 32), ...scalar(27, 1900), ...scalar(47, 24),
  ];
  return new Uint8Array(message(3, message(1, message(2, record))));
}

describe('附近排序', () => {
  test('稀有优先，其次距离', () => {
    const rare: WildPet = decorateWildPet(HUSKY);
    const plain: WildPet = decorateWildPet({ ...HUSKY, uniqueId: 2, voiceDb: 0 });
    const rows = sortNearby([
      withDistance(plain, { x: HUSKY.pos.x, y: HUSKY.pos.y }),
      withDistance(rare, { x: HUSKY.pos.x + 10000, y: HUSKY.pos.y }),
    ]);
    expect(rows[0].uniqueId).toBe(rare.uniqueId);
  });

  test('距离按 100:1 世界单位换算成米', () => {
    const row = withDistance(decorateWildPet(HUSKY), { x: HUSKY.pos.x + 1000, y: HUSKY.pos.y });
    expect(row.distanceM).toBeCloseTo(10);
  });
});
