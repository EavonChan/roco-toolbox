import { describe, test } from 'vitest';
import fs from 'node:fs';
import { extractBusinessFrames, extractPcap } from '../pcap-decoder/tools/pcap-json-app/src/core';

/**
 * P0 探针：验证真实抓包里有没有「野外附近精灵」实体帧。
 *
 * 用法：`set PROBE_CAPTURE=D:\path\to\wild.pcap && npx vitest run src/pcap/probeRealCapture.test.ts`
 * 没设置环境变量或文件不存在时自动跳过，不影响日常测试与 CI。
 */
const CAPTURE = process.env.PROBE_CAPTURE || '';
const available = Boolean(CAPTURE) && fs.existsSync(CAPTURE);

type Fields = Map<number, Array<bigint | Uint8Array>>;

function readVarint(bytes: Uint8Array, offset: number) {
  let value = 0n, shift = 0n;
  for (let i = offset; i < bytes.length && shift <= 63n; i += 1, shift += 7n) {
    value |= BigInt(bytes[i] & 0x7f) << shift;
    if ((bytes[i] & 0x80) === 0) return { value, next: i + 1 };
  }
  return null;
}
function parseFields(bytes: Uint8Array): Fields {
  const fields: Fields = new Map();
  let i = 0;
  while (i < bytes.length) {
    const tag = readVarint(bytes, i);
    if (!tag) break;
    i = tag.next;
    const field = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (field <= 0) break;
    if (wire === 0) {
      const v = readVarint(bytes, i); if (!v) break;
      i = v.next;
      push(fields, field, v.value);
    } else if (wire === 1) i += 8;
    else if (wire === 2) {
      const len = readVarint(bytes, i); if (!len) break;
      i = len.next;
      const end = Number(i) + Number(len.value);
      if (end > bytes.length) break;
      push(fields, field, bytes.subarray(Number(i), end));
      i = end;
    } else if (wire === 5) i += 4;
    else break;
  }
  return fields;
}
function push(fields: Fields, field: number, value: bigint | Uint8Array) {
  const list = fields.get(field) || [];
  list.push(value);
  fields.set(field, list);
}
function sub(fields: Fields, field: number, index = 0): Uint8Array | null {
  const value = (fields.get(field) || [])[index];
  return value instanceof Uint8Array ? value : null;
}
function scalar(fields: Fields, field: number): bigint | null {
  const list = (fields.get(field) || []).filter((v): v is bigint => typeof v === 'bigint');
  return list.length ? list[0] : null;
}
function signed(v: bigint | null): number {
  if (v == null) return 0;
  return Number(v >= 0x8000000000000000n ? v - 0x10000000000000000n : v);
}

/** 与多多工具箱 `ra()` 相同的字段路径：顶层 field 11 → actor → pet/identity。 */
function parseEntity(bytes: Uint8Array) {
  const actor = sub(parseFields(bytes), 11);
  if (!actor) return null;
  const t = parseFields(actor);
  const identity = sub(t, 1);
  const pet = sub(t, 3);
  if (!pet) return null;
  const id = identity ? parseFields(identity) : null;
  const p = parseFields(pet);
  const posWrap = id ? sub(id, 8) : null;
  const posMsg = posWrap ? sub(parseFields(posWrap), 1) : null;
  const pos = posMsg ? parseFields(posMsg) : null;
  const glassWrap = sub(p, 30);
  const glass = glassWrap ? parseFields(glassWrap) : null;
  return {
    actorId: signed((id && scalar(id, 1)) || scalar(t, 1)),
    cfgId: signed(scalar(p, 1)),
    level: id ? signed(scalar(id, 11)) : 0,
    height: signed(scalar(p, 11)),
    weight: signed(scalar(p, 12)),
    mutation: signed(scalar(p, 14)),
    voice: signed(scalar(p, 31)),
    uniqueId: signed(scalar(p, 17)),
    glassType: glass ? signed(scalar(glass, 1)) : 0,
    pos: pos ? { x: signed(scalar(pos, 1)), y: signed(scalar(pos, 2)), z: signed(scalar(pos, 3)) } : null,
  };
}

(available ? describe : describe.skip)('P0 真实抓包探针', () => {
  test('统计 opcode 与附近实体字段', () => {
    const bytes = new Uint8Array(fs.readFileSync(CAPTURE));
    const extracted = extractPcap(bytes, { allowTruncated: true, retainRawProtocol: false }) as any;
    console.log('packets', extracted.packets, 'hasKey', extracted.hasKey, 'records', extracted.records.length,
      'eggs', extracted.eggInventory ? extracted.eggInventory.eggs.length : 0, 'truncated', extracted.truncated);
    console.log('nearbyPets', extracted.nearbyPets?.length ?? 0, 'nearbyScene', extracted.nearbyScene);
    console.log('nearby sample', JSON.stringify((extracted.nearbyPets || []).slice(0, 3)));

    const frames = extractBusinessFrames(bytes, { allowTruncated: true });
    const counts = new Map<number, number>();
    for (const frame of frames) {
      if ('error' in frame) continue;
      counts.set(frame.opcode, (counts.get(frame.opcode) || 0) + 1);
    }
    console.log('opcodes', [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
      .map(([op, n]) => `${op}=${n}`).join('  '));
    console.log('330/1043/1044/338 =', counts.get(330) || 0, counts.get(1043) || 0, counts.get(1044) || 0, counts.get(338) || 0);

    const scene = frames.find((f) => !('error' in f) && f.opcode === 338);
    if (scene && !('error' in scene)) {
      const root = parseFields(new Uint8Array(Buffer.from(scene.payloadHex, 'hex')));
      console.log('338 scene =', (root.get(3) || []).map(String).join('|') || '?');
    }

    const entities: ReturnType<typeof parseEntity>[] = [];
    for (const frame of frames) {
      if ('error' in frame || ![330, 1043, 1044].includes(frame.opcode)) continue;
      const root = parseFields(new Uint8Array(Buffer.from(frame.payloadHex, 'hex')));
      const candidates: Uint8Array[] = [];
      for (const raw of root.get(7) || []) if (raw instanceof Uint8Array) candidates.push(raw);
      for (const wrap of root.get(1) || []) {
        if (!(wrap instanceof Uint8Array)) continue;
        for (const inner of parseFields(wrap).get(1) || []) if (inner instanceof Uint8Array) candidates.push(inner);
      }
      for (const candidate of candidates) {
        const parsed = parseEntity(candidate);
        if (parsed) entities.push(parsed);
      }
    }
    const wild = entities.filter((e) => e && e.cfgId >= 10000 && e.cfgId <= 19999 && e.height > 0 && e.weight > 0);
    console.log('entities', entities.length, 'wild-like', wild.length);
    for (const e of wild.slice(0, 10)) console.log(JSON.stringify(e));
    if (!wild.length) console.log('样本里没有 10000–19999 的野生实体；这份包不是野外场景');
  }, 120000);
});
