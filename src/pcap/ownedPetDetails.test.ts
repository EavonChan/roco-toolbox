import { describe, expect, test } from 'vitest';
import { parseOwnedPetDetails } from '../pcap-decoder/tools/pcap-json-app/src/core';

const varint = (value: number): number[] => {
  const bytes: number[] = [];
  let v = value;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  bytes.push(v & 0x7f);
  return bytes;
};
const tag = (field: number, wire: number) => varint((field << 3) | wire);
const scalar = (field: number, value: number) => [...tag(field, 0), ...varint(value)];
const message = (field: number, body: number[]) => [...tag(field, 2), ...varint(body.length), ...body];

/** 与真实包里的宠物记录结构一致（月亮砣 45 级 / 186 / 140445 / 性格 7 天真 / 性别 1 公）。 */
const record = (overrides: Partial<Record<number, number>> = {}) => {
  const fields: Record<number, number> = {
    7: 7, 8: 1, 10: 45, 15: 3583, 26: 186, 27: 140445, 47: 10, 93: 84,
    ...overrides,
  };
  const body: number[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (value === 0) continue;
    body.push(...scalar(Number(field), value));
  }
  return body;
};

const payload = (...records: number[][]) => new Uint8Array([
  ...message(1, records.map((body) => message(1, body)).reduce((all, item) => [...all, ...item], [])),
]);

describe('宠物记录里的性格/性别解析', () => {
  test('按 field7/8/10/15/26/27/47 读性格、性别、等级、身高体重', () => {
    expect(parseOwnedPetDetails(payload(record()))).toEqual([{
      petId: 3583, level: 45, height: 186, weight: 140445,
      natureId: 7, genderId: 1, bloodId: 10, voiceDb: 84,
    }]);
  });

  test('四种爆焰仔样本按性格 id 区分', () => {
    const rows = parseOwnedPetDetails(payload(
      record({ 7: 10, 8: 2, 10: 13, 15: 3572, 26: 83, 27: 37032 }),
      record({ 7: 18, 8: 1, 10: 14, 15: 3572, 26: 73, 27: 28432 }),
      record({ 7: 23, 8: 2, 10: 14, 15: 3572, 26: 72, 27: 27610 }),
      record({ 7: 21, 8: 2, 10: 12, 15: 3572, 26: 66, 27: 22064 }),
    ));
    expect(rows.map((row) => [row.natureId, row.genderId, row.level, row.height, row.weight])).toEqual([
      [10, 2, 13, 83, 37032],
      [18, 1, 14, 73, 28432],
      [23, 2, 14, 72, 27610],
      [21, 2, 12, 66, 22064],
    ]);
  });

  test('缺性格或性别字段时不误判', () => {
    expect(parseOwnedPetDetails(payload(record({ 7: 0 })))).toEqual([]);
    expect(parseOwnedPetDetails(payload(record({ 8: 0 })))).toEqual([]);
    expect(parseOwnedPetDetails(payload(record({ 47: 0 })))).toEqual([]);
  });
});
