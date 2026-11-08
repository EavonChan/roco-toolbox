import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { SeasonEncounter } from './captureProgress';
import {
  battleTargetHit,
  getBattleTarget,
  isBattleTargetEmpty,
  resetBattleTargetForTest,
  setBattleTarget,
} from './battleTargetStore';

const encounter = (overrides: Partial<SeasonEncounter> = {}): SeasonEncounter => ({
  guardName: '龙棋士', rewardPetId: 3011, rewardName: '恶魔狼',
  level: 41, natureId: 4, natureConfirmed: true, nature: '勇敢',
  gender: '公', height: 180, weight: 82000, heightPct: 45, weightPct: 30, voiceDb: 14,
  ...overrides,
});

beforeEach(() => {
  window.localStorage.clear();
  resetBattleTargetForTest();
});

describe('战斗强提醒目标（battleTargetStore）', () => {
  test('没设目标（全空）时永不变色', () => {
    expect(isBattleTargetEmpty(getBattleTarget())).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter())).toBe(false);
  });

  test('encounter 为空不算命中', () => {
    setBattleTarget({ natures: ['勇敢'] });
    expect(battleTargetHit(getBattleTarget(), null)).toBe(false);
    expect(battleTargetHit(getBattleTarget(), undefined)).toBe(false);
  });

  test('性格必须已确认：30 占位（natureConfirmed=false）不算命中', () => {
    setBattleTarget({ natures: ['勇敢'] });
    expect(battleTargetHit(getBattleTarget(), encounter())).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ natureConfirmed: false, nature: '' }))).toBe(false);
  });

  test('性格多选：选中任意一个即算命中（维度内取或）', () => {
    setBattleTarget({ natures: ['胆小', '勇敢'] });
    expect(battleTargetHit(getBattleTarget(), encounter())).toBe(true);
    setBattleTarget({ natures: ['胆小', '固执'] });
    expect(battleTargetHit(getBattleTarget(), encounter())).toBe(false);
  });

  test('声音牌：婉转声 ≥96dB / 粗嗓门 ≤-96dB，与全站筛选同口径', () => {
    setBattleTarget({ voices: ['婉转声'] });
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 96 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 95 }))).toBe(false);
    setBattleTarget({ voices: ['粗嗓门'] });
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: -96 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: -95 }))).toBe(false);
    // 战斗帧还没拿到声音（null）不算命中
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: null }))).toBe(false);
  });

  test('声音 ±100dB 档：只有雷达主动提醒级别的极端值才命中', () => {
    setBattleTarget({ voices: ['+100'] });
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 100 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 96 }))).toBe(false);
    setBattleTarget({ voices: ['-100'] });
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: -100 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: -96 }))).toBe(false);
  });

  test('声音多选：选中任意一档即算命中', () => {
    setBattleTarget({ voices: ['+100', '-100'] });
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: -100 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 100 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 96 }))).toBe(false);
  });

  test('体型牌：体重百分位 ≥98 / ≤2；多选取或', () => {
    setBattleTarget({ bodies: ['big'] });
    expect(battleTargetHit(getBattleTarget(), encounter({ weightPct: 98 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ weightPct: 97 }))).toBe(false);
    // 图鉴缺区间（null）不算命中
    expect(battleTargetHit(getBattleTarget(), encounter({ weightPct: null }))).toBe(false);
    setBattleTarget({ bodies: ['big', 'small'] });
    expect(battleTargetHit(getBattleTarget(), encounter({ weightPct: 2 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ weightPct: 98 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ weightPct: 50 }))).toBe(false);
  });

  test('性别匹配（公母互斥，保持单选）', () => {
    setBattleTarget({ gender: '母' });
    expect(battleTargetHit(getBattleTarget(), encounter({ gender: '母' }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter())).toBe(false);
  });

  test('any：满足其一即命中；全不满足才不变色', () => {
    setBattleTarget({ natures: ['胆小'], gender: '母', voices: ['婉转声'] });
    expect(battleTargetHit(getBattleTarget(), encounter())).toBe(false);
    expect(battleTargetHit(getBattleTarget(), encounter({ gender: '母' }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 100 }))).toBe(true);
  });

  test('all：全部满足才命中（维度内多选仍只算一个维度）', () => {
    setBattleTarget({ natures: ['勇敢'], gender: '公', voices: ['婉转声'], mode: 'all' });
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 100 }))).toBe(true);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 14 }))).toBe(false);
    expect(battleTargetHit(getBattleTarget(), encounter({ voiceDb: 100, gender: '母' }))).toBe(false);
    // 性格多选两个，all 模式也不要求两个性格同时成立（那不可能），命中其一即可
    setBattleTarget({ natures: ['勇敢', '胆小'], gender: '公', voices: [], bodies: [], mode: 'all' });
    expect(battleTargetHit(getBattleTarget(), encounter())).toBe(true);
  });

  test('目标写入 localStorage，刷新后仍在', () => {
    setBattleTarget({ natures: ['勇敢'], mode: 'all' });
    const raw = window.localStorage.getItem('roco.battleTarget');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({ natures: ['勇敢'], mode: 'all' });
  });

  test('旧版单选数据（nature/voice/body + 旧代号）加载时自动迁移成多选', async () => {
    window.localStorage.setItem(
      'roco.battleTarget',
      JSON.stringify({ nature: '勇敢', gender: '母', voice: 'high100', body: 'big', mode: 'all' }),
    );
    // 迁移在模块加载时执行：重置模块注册表后重新 import 才会读到上面的旧数据
    vi.resetModules();
    const fresh = await import('./battleTargetStore');
    expect(fresh.getBattleTarget()).toEqual({
      natures: ['勇敢'],
      gender: '母',
      voices: ['+100'],
      bodies: ['big'],
      mode: 'all',
    });
  });
});
