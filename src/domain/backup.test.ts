import { describe, expect, test } from 'vitest';
import {
  BACKUP_TYPE,
  backupFileName,
  buildBackup,
  mergeSnapshots,
  parseToolboxBackup,
} from './backup';
import type { AccountSnapshot } from './parseBackup';
import type { HomeSnapshot, OwnedPet } from './types';

/** 账号名 → 稳定的假 UID（真实场景 UID 唯一；测试里按名字派生，保证不同账号不同主键） */
const gameIdOf = (name: string): number =>
  [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 7);

const snapshot = (name: string, count: number): AccountSnapshot => ({
  accountName: name,
  gameId: gameIdOf(name),
  exportedAt: '2026-09-25T12:00:00.000Z',
  importedAt: '2026-09-26T00:00:00.000Z',
  pets: Array.from({ length: count }, (_, i) => ({
    gameId: i,
    name: `精灵${i}`,
    gender: '母' as const,
    nature: '固执',
    voiceDb: 100,
    medalBody: '大块头',
    isShiny: false,
    account: name,
  })),
  eggs: [],
});

/** 同一个账号、不同的数据时刻（数据自身时刻与导入时刻一起变，模拟两次不同时间的采集） */
const at = (name: string, when: string, count = 1): AccountSnapshot => ({
  ...snapshot(name, count),
  exportedAt: when,
  importedAt: when,
});

/** 一份最小家园快照（只用来验证「导入不会把家园弄丢」） */
const homeOf = (capturedAt: string): HomeSnapshot => ({
  schemaVersion: 1,
  gameId: '1',
  capturedAt,
  residents: [],
  nests: [],
  layEggCouples: [{ femaleActorId: 'f', maleActorIds: ['m'] }],
  sceneEggs: [],
  couplesStale: false,
});

describe('buildBackup / parseToolboxBackup', () => {
  test('preserves egg snapshot completeness through backup restore', () => {
    const saved=buildBackup([{...snapshot('甲',0),eggInventoryComplete:true}],{exportedAt:'now',catalogVersion:'s4'});
    expect(parseToolboxBackup(saved).accounts[0].eggInventoryComplete).toBe(true);
  });
  test('早期备份缺奖牌时，用体重百分位按 98% / 2% 补回（与抓包导入同口径）', () => {
    const parsed = parseToolboxBackup({
      type: BACKUP_TYPE,
      version: 1,
      exportedAt: '2026-09-26T10:00:00.000Z',
      catalogVersion: 's4',
      accounts: [
        {
          accountName: '测试甲',
          gameId: 1001,
          exportedAt: '2026-09-25T12:00:00.000Z',
          importedAt: '2026-09-26T00:00:00.000Z',
          pets: [
            { gameId: 1, name: '甲', gender: '母', nature: '固执', voiceDb: 100, weightPercent: 99 },
            { gameId: 2, name: '乙', gender: '母', nature: '固执', voiceDb: 100, weightPercent: 1 },
            { gameId: 3, name: '丙', gender: '母', nature: '固执', voiceDb: 100, weightPercent: 50 },
          ],
          eggs: [],
        },
      ],
    });
    expect(parsed.accounts[0].pets.map((pet) => pet.medalBody)).toEqual(['大块头', '小不点', '']);
  });

  test('导出的备份带有类型标记，能被自己解析回来', () => {
    const backup = buildBackup([snapshot('测试甲', 2), snapshot('测试丙', 3)], {
      exportedAt: '2026-09-26T10:00:00.000Z',
      catalogVersion: 's4-2026-09-24',
    });
    expect(backup.type).toBe(BACKUP_TYPE);
    expect(backup.accounts).toHaveLength(2);

    const parsed = parseToolboxBackup(JSON.parse(JSON.stringify(backup)));
    expect(parsed.accounts.map((a) => a.accountName)).toEqual(['测试甲', '测试丙']);
    expect(parsed.accounts[1].pets).toHaveLength(3);
  });

  test('文件名带日期', () => {
    expect(backupFileName('2026-09-26T10:00:00.000Z')).toBe('小布助手备份-2026-09-26.json');
  });

  test('家园快照跟着导出/导入保留', () => {
    const withHome: AccountSnapshot = {
      ...snapshot('测试甲', 1),
      home: {
        schemaVersion: 1,
        gameId: String(gameIdOf('测试甲')),
        capturedAt: '2026-10-27T00:00:00.000Z',
        couplesStale: false,
        residents: [
          {
            instanceId: '11',
            baseId: '22',
            furnitureGuid: '88',
            actorId: '77',
            name: '母本甲',
            gender: '母',
            nest: { furnitureGuid: '88', configId: 1001072, nestType: 'academy', nestName: '学院小窝' },
          },
        ],
        nests: [{ furnitureGuid: '88', configId: 1001072, nestType: 'academy', nestName: '学院小窝', residentIds: ['11'] }],
        layEggCouples: [{ femaleActorId: '77', maleActorIds: ['78'] }],
        sceneEggs: [{ actorId: '99', furnitureGuid: '88', npcConfigId: 301 }],
      },
    };
    const parsed = parseToolboxBackup(
      JSON.parse(
        JSON.stringify(
          buildBackup([withHome], { exportedAt: '2026-10-27T00:00:00.000Z', catalogVersion: 's4' }),
        ),
      ),
    );
    expect(parsed.accounts[0].home?.residents[0].name).toBe('母本甲');
    expect(parsed.accounts[0].home?.sceneEggs).toHaveLength(1);
  });

  test('抓包文件会被明确拒绝（给出可读错误）', () => {
    expect(() => parseToolboxBackup({ meta: { type: 'hatch-backup' } })).toThrow(/备份文件/);
  });

  test('备份里没有账号数据时报错', () => {
    expect(() => parseToolboxBackup({ type: BACKUP_TYPE, accounts: [] })).toThrow(/没有可用/);
    expect(() => parseToolboxBackup({ type: BACKUP_TYPE })).toThrow(/accounts/);
  });

  test('损坏的账号条目会被过滤掉，不影响其他账号', () => {
    const parsed = parseToolboxBackup({
      type: BACKUP_TYPE,
      accounts: [snapshot('测试甲', 1), { broken: true }, null],
    });
    expect(parsed.accounts).toHaveLength(1);
  });

  test('账号里损坏的精灵条目被逐只清洗（m3：pets 元素不再整组放过）', () => {
    const good = snapshot('测试甲', 1).pets[0]!;
    const parsed = parseToolboxBackup({
      type: BACKUP_TYPE,
      accounts: [{ ...snapshot('测试甲', 0), pets: [good, null, 42, { name: '坏蛋' }] }],
    });
    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.accounts[0].pets).toHaveLength(2); // null / 42 被丢弃
    expect(parsed.accounts[0].pets.map((p) => p.name)).toEqual(['精灵0', '坏蛋']);
    // 缺失字段按防御式口径归一化，不带脏数据进库
    expect(parsed.accounts[0].pets[1]).toMatchObject({
      gameId: 0,
      gender: '未知',
      voiceDb: 0,
      isShiny: false,
      account: '测试甲',
    });
  });

  test('账号级字段被归一化：缺 gameId 的老备份不会误判成另一个账号', () => {
    const parsed = parseToolboxBackup({
      type: BACKUP_TYPE,
      // 老格式：账号级没有 gameId / 时间 / 蛋仓
      accounts: [{ accountName: '测试甲', pets: [] }],
    });
    expect(parsed.accounts[0].gameId).toBe(0);
    expect(parsed.accounts[0].exportedAt).toBe('');
    expect(parsed.accounts[0].eggs).toEqual([]);

    // gameId 归一化成 0（= 老数据没带编号）→ 按账号名兜底匹配到本地同一账号（不是新增一个）
    const merged = mergeSnapshots([snapshot('测试甲', 1)], parsed.accounts);
    expect(merged.added).toEqual([]);
    expect(merged.kept).toEqual(['测试甲']);
    expect(merged.snapshots).toHaveLength(1);
  });
});

describe('mergeSnapshots 多设备合并', () => {
  test('备份里独有的账号并入，本地独有的账号照样保留', () => {
    const result = mergeSnapshots([snapshot('平板的号', 2)], [snapshot('手机的号', 3)]);
    expect(result.snapshots.map((s) => s.accountName)).toEqual(['平板的号', '手机的号']);
    expect(result.added).toEqual(['手机的号']);
    expect(result.updated).toEqual([]);
    expect(result.kept).toEqual([]);
  });

  test('同账号取导入时间较新的那份（备份更新 → 替换）', () => {
    const result = mergeSnapshots(
      [at('测试甲', '2026-09-26T00:00:00.000Z', 2)],
      [at('测试甲', '2026-09-27T00:00:00.000Z', 5)],
    );
    expect(result.updated).toEqual(['测试甲']);
    expect(result.snapshots[0].pets).toHaveLength(5);
  });

  test('同账号本地更新 → 保留本地，不会被旧备份顶回去', () => {
    const result = mergeSnapshots(
      [at('测试甲', '2026-09-27T00:00:00.000Z', 5)],
      [at('测试甲', '2026-09-26T00:00:00.000Z', 2)],
    );
    expect(result.kept).toEqual(['测试甲']);
    expect(result.updated).toEqual([]);
    expect(result.snapshots[0].pets).toHaveLength(5);
  });

  test('新数据没带家园（这次没进家园场景）→ 保留本机原有家园', () => {
    // 2026-11-01 用户反馈：导入一次背包数据后家园整个消失
    const local: AccountSnapshot = {
      ...at('测试甲', '2026-09-26T00:00:00.000Z', 2),
      home: homeOf('2026-09-25T00:00:00.000Z'),
    };
    const incoming = at('测试甲', '2026-09-27T00:00:00.000Z', 5);

    const result = mergeSnapshots([local], [incoming]);
    expect(result.updated).toEqual(['测试甲']);
    expect(result.snapshots[0].pets).toHaveLength(5);
    expect(result.snapshots[0].home?.capturedAt).toBe('2026-09-25T00:00:00.000Z');
  });

  test('新数据带家园 → 用新采的家园', () => {
    const local: AccountSnapshot = {
      ...at('测试甲', '2026-09-26T00:00:00.000Z', 2),
      home: homeOf('2026-09-25T00:00:00.000Z'),
    };
    const incoming: AccountSnapshot = {
      ...at('测试甲', '2026-09-27T00:00:00.000Z', 5),
      home: homeOf('2026-09-27T00:00:00.000Z'),
    };

    const result = mergeSnapshots([local], [incoming]);
    expect(result.snapshots[0].home?.capturedAt).toBe('2026-09-27T00:00:00.000Z');
  });

  test('时间相同时保留本地', () => {
    const result = mergeSnapshots(
      [at('测试甲', '2026-09-26T00:00:00.000Z', 5)],
      [at('测试甲', '2026-09-26T00:00:00.000Z', 2)],
    );
    expect(result.kept).toEqual(['测试甲']);
    expect(result.snapshots[0].pets).toHaveLength(5);
  });

  test('云同步路径（tieBreak: incoming）：时间相同时取云端那份，两台设备才能收敛', () => {
    // 同一账号两边各采一份、采集器给出的时间戳完全相同 → 内容却不同。
    // 默认（导入用）保留本机；云同步必须取云端，否则两台各留各的、永远合不到一起。
    const result = mergeSnapshots(
      [at('测试甲', '2026-09-26T00:00:00.000Z', 2)],
      [at('测试甲', '2026-09-26T00:00:00.000Z', 5)],
      { tieBreak: 'incoming' },
    );
    expect(result.updated).toEqual(['测试甲']);
    expect(result.kept).toEqual([]);
    expect(result.snapshots[0].pets).toHaveLength(5);
  });

  test('时间不可比较时保留本地，不用来路不明的数据覆盖', () => {
    const result = mergeSnapshots(
      [{ ...snapshot('测试甲', 5), exportedAt: '', importedAt: '' }],
      [at('测试甲', '2026-09-27T00:00:00.000Z', 2)],
    );
    expect(result.kept).toEqual(['测试甲']);
    expect(result.snapshots[0].pets).toHaveLength(5);
  });

  test('空备份不改变本地数据', () => {
    const local = [snapshot('测试甲', 2)];
    const result = mergeSnapshots(local, []);
    expect(result.snapshots.map((s) => s.accountName)).toEqual(['测试甲']);
    expect(result.added).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(result.kept).toEqual([]);
  });

  test('两边完全一致时不做任何改动（幂等：反复导入同一份不会变）', () => {
    const local = [snapshot('测试甲', 2), snapshot('测试丙', 1)];
    const result = mergeSnapshots(local, [snapshot('测试甲', 2), snapshot('测试丙', 1)]);
    expect(result.snapshots.map((s) => s.accountName)).toEqual(['测试甲', '测试丙']);
    expect([...result.added, ...result.updated]).toEqual([]);
    expect(result.kept.sort()).toEqual(['测试甲', '测试丙'].sort());
  });

  test('判据用数据自身的时刻：导出时间旧的抓包即使现在才导入，也顶不掉本地更新的那份', () => {
    const result = mergeSnapshots(
      [
        {
          ...snapshot('测试甲', 5),
          exportedAt: '2026-09-20T00:00:00.000Z',
          importedAt: '2026-09-20T00:00:00.000Z',
        },
      ],
      // 数据是 9-10 的旧抓包，但今天（9-30）才导入 → importedAt 最新
      [{ ...snapshot('测试甲', 2), exportedAt: '2026-09-10T00:00:00.000Z', importedAt: '2026-09-30T00:00:00.000Z' }],
    );
    expect(result.kept).toEqual(['测试甲']);
    expect(result.updated).toEqual([]);
    expect(result.snapshots[0].pets).toHaveLength(5);
  });

  test('同名但 UID 不同（两个真实账号）：两份都保留，不再丢弃第二份', () => {
    const result = mergeSnapshots(
      [{ ...snapshot('测试甲', 3), gameId: 111 }],
      [
        {
          ...snapshot('测试甲', 2),
          gameId: 222,
          exportedAt: '2026-09-30T00:00:00.000Z',
          importedAt: '2026-09-30T00:00:00.000Z',
        },
      ],
    );
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots.map((s) => s.gameId).sort()).toEqual([111, 222]);
    expect(result.added).toEqual(['测试甲']);
    expect(result.updated).toEqual([]);
    expect(result.snapshots.find((s) => s.gameId === 111)?.pets).toHaveLength(3);
    expect(result.snapshots.find((s) => s.gameId === 222)?.pets).toHaveLength(2);
  });

  test('本地账号缺 UID（老数据）时按账号名兜底，仍按时间合并', () => {
    const result = mergeSnapshots(
      [{ ...snapshot('测试甲', 3), gameId: 0 }],
      [at('测试甲', '2026-09-30T00:00:00.000Z', 2)],
    );
    expect(result.updated).toEqual(['测试甲']);
    expect(result.added).toEqual([]);
    // 主键从 name: 升级成 uid:，只留一份
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].gameId).toBe(gameIdOf('测试甲'));
  });
});

/**
 * 三维（`individualBonuses` / `rawFields`）跨快照保留（2026-11-24）：
 * 整份快照仍按「数据时刻」取较新，但三维这两个字段要按宠物身份做字段级保留——
 * 正式版客户端上传的快照不带三维，不能因为时间更新就把本机已有的三维抹掉。
 */
describe('三维字段跨快照保留', () => {
  /** 一只带身份（captureId）的宠物；三维按需给，用来区分「新客户端 / 旧客户端」两份快照 */
  const ownedPet = (captureId: string, name: string, extra: Partial<OwnedPet> = {}): OwnedPet => ({
    gameId: 3001,
    name,
    captureId,
    gender: '母',
    nature: '固执',
    voiceDb: 100,
    medalBody: '',
    isShiny: false,
    account: '测试甲',
    ...extra,
  });

  const snapshotOfPets = (when: string, pets: OwnedPet[]): AccountSnapshot => ({
    ...at('测试甲', when, 0),
    pets,
  });

  const withBonuses = (): Partial<OwnedPet> => ({
    individualBonuses: [
      { name: '物攻', value: 8 },
      { name: '速度', value: 10 },
    ],
    rawFields: { bytes: { '14': ['0a023800120238081a023809220238002a0238003202380a'] } },
  });

  test('旧快照（无三维）+ 新快照（有三维）→ 合并结果保留三维', () => {
    const old = snapshotOfPets('2026-11-22T00:00:00.000Z', [ownedPet('c1', '甲兽')]);
    const fresh = snapshotOfPets('2026-11-23T00:00:00.000Z', [ownedPet('c1', '甲兽', withBonuses())]);

    const merged = mergeSnapshots([old], [fresh], { tieBreak: 'incoming' });
    expect(merged.updated).toEqual(['测试甲']);
    expect(merged.snapshots[0].pets[0].individualBonuses).toEqual([
      { name: '物攻', value: 8 },
      { name: '速度', value: 10 },
    ]);
    expect(merged.snapshots[0].pets[0].rawFields).toEqual(withBonuses().rawFields);
  });

  test('新快照（无三维）覆盖旧快照（有三维）→ 三维不被抹掉', () => {
    // 云同步：平局取云端（tieBreak: 'incoming'），云端是正式版上传的、不带三维的那份
    const cloud = snapshotOfPets('2026-11-23T00:00:00.000Z', [ownedPet('c1', '甲兽')]);
    const local = snapshotOfPets('2026-11-22T00:00:00.000Z', [ownedPet('c1', '甲兽', withBonuses())]);

    const synced = mergeSnapshots([local], [cloud], { tieBreak: 'incoming' });
    expect(synced.updated).toEqual(['测试甲']);
    const syncedPet = synced.snapshots[0].pets[0];
    expect(syncedPet.individualBonuses).toEqual([
      { name: '物攻', value: 8 },
      { name: '速度', value: 10 },
    ]);
    expect(syncedPet.rawFields).toEqual(withBonuses().rawFields);
    // 整份快照仍是「新的那份」，三维只是被字段级补回
    expect(synced.snapshots[0].exportedAt).toBe('2026-11-23T00:00:00.000Z');

    // 备份导入：默认平局保留本机，但新快照更新时同样不能把三维抹掉
    const imported = mergeSnapshots([local], [cloud]);
    expect(imported.updated).toEqual(['测试甲']);
    expect(imported.snapshots[0].pets[0].individualBonuses).toEqual([
      { name: '物攻', value: 8 },
      { name: '速度', value: 10 },
    ]);
    expect(imported.snapshots[0].exportedAt).toBe('2026-11-23T00:00:00.000Z');
  });

  test('只补字段不增删宠物：旧快照独有的精灵不会被带回来（放生不复活）', () => {
    const local = snapshotOfPets('2026-11-22T00:00:00.000Z', [
      ownedPet('c1', '甲兽', withBonuses()),
      ownedPet('c2', '已放生', withBonuses()),
    ]);
    const incoming = snapshotOfPets('2026-11-23T00:00:00.000Z', [ownedPet('c1', '甲兽')]);

    const merged = mergeSnapshots([local], [incoming], { tieBreak: 'incoming' });
    expect(merged.snapshots[0].pets.map((pet) => pet.name)).toEqual(['甲兽']);
    expect(merged.snapshots[0].pets[0].individualBonuses).toEqual([
      { name: '物攻', value: 8 },
      { name: '速度', value: 10 },
    ]);
  });

  test('备份清洗后三维仍在；rawFields 只白名单保留 bytes["14"]', () => {
    const parsed = parseToolboxBackup({
      type: BACKUP_TYPE,
      accounts: [
        {
          accountName: '测试甲',
          gameId: 1001,
          exportedAt: '2026-11-24T00:00:00.000Z',
          importedAt: '2026-11-24T00:00:00.000Z',
          eggs: [],
          pets: [
            {
              gameId: 1,
              name: '甲兽',
              individualBonuses: [{ name: '物攻', value: 8 }],
              // 全量协议字段不能原样存（体积）：只留三维用到的 bytes["14"]，其余键丢掉
              rawFields: {
                int: { '1': [42] },
                bytes: { '1': ['aabb'], '14': ['0a023800120238081a023809220238002a0238003202380a'] },
                fieldCount: 3,
                occurrences: 1,
                source: { from: 'pcap' },
              },
            },
            {
              gameId: 2,
              name: '乙兽',
              rawFields: { bytes: { '14': ['0a023800120238081a023809220238002a0238003202380a'] } },
            },
            { gameId: 3, name: '丙兽' },
          ],
        },
      ],
    });

    const [first, second, third] = parsed.accounts[0].pets;
    expect(first.individualBonuses).toEqual([{ name: '物攻', value: 8 }]);
    expect(first.rawFields).toEqual({
      bytes: { '14': ['0a023800120238081a023809220238002a0238003202380a'] },
    });
    // 只有 rawFields、没有 individualBonuses 的老备份 → 从 field 14 解出数值
    expect(second.individualBonuses).toEqual([
      { name: '物攻', value: 8 },
      { name: '魔攻', value: 9 },
      { name: '速度', value: 10 },
    ]);
    expect(second.rawFields).toEqual({
      bytes: { '14': ['0a023800120238081a023809220238002a0238003202380a'] },
    });
    // 两个字段都没有 → 不伪造
    expect(third.individualBonuses).toBeUndefined();
    expect(third.rawFields).toBeUndefined();
  });
});
