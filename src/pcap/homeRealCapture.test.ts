import { describe, expect, test } from 'vitest';
import raw from './__fixtures__/home-real-capture.json';
import { parseHomeSnapshot } from '../domain/parseBackup';

/**
 * 真实抓包的家园回归夹具（2026-11-01，R2-7-L11 / 原 B9-L05）。
 *
 * 来源：用户上传的真实采集文件，用 `convertPcapBytes` 解出 `meta.captureHome` 后**脱敏**保存：
 * 真实游戏账号编号与采集时间已替换，其余结构（住户 / 小窝 / 配对 / 层级）原样保留。
 *
 * 为什么不是 .pcap：原始抓包里的业务负载是压缩帧（zlib / gzip），字节级改字段会让帧失效，
 * 而上游解析器只提供「pcap → JSON」单向入口、没有反向封装能力。这里保存的是**解析后的真实结构**，
 * 用来挡「parseHomeSnapshot / 家园页面字段口径被改坏」，不再依赖手写 protobuf（那份仍在
 * `homeProtocol.test.ts` 覆盖解码层）。
 */
const fixture = raw as { gameId: string; capturedAt: string } & Record<string, unknown>;

describe('真实抓包的家园快照（脱敏夹具）', () => {
  test('真实抓包的结构能被 parseHomeSnapshot 完整接收', () => {
    const home = parseHomeSnapshot(fixture);
    expect(home).toBeDefined();
    // 数字来自这份真实抓包本身：10 个住户、11 个小窝、5 对孵蛋配对、没有地上的蛋
    expect(home!.residents).toHaveLength(10);
    expect(home!.nests).toHaveLength(11);
    expect(home!.layEggCouples).toHaveLength(5);
    expect(home!.sceneEggs).toHaveLength(0);

    // 学院小窝那一只是真实住户：头像 / 窝名 / 窝类型都要原样带出来
    const academy = home!.residents.find((resident) => resident.nest?.nestType === 'academy');
    expect(academy).toBeDefined();
    expect(academy!.name).toBe('石肤蜥');
    expect(academy!.nest!.nestName).toBe('学院小窝');
    expect(academy!.nest!.configId).toBe(1001072);
  });

  test('夹具已脱敏：不含真实游戏账号编号', () => {
    expect(fixture.gameId).toBe('0');
    expect(JSON.stringify(fixture)).not.toContain('293143');
  });
});
