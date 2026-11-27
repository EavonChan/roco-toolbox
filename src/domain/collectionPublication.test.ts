import { describe, expect, test } from 'vitest';
import { motherResourceCriteriaIdOf, type PublishedMotherResource } from '../shared/motherGroups';
import { studSlotSetIdOf, type PublishedStudResource, type StudTargetConfig } from '../shared/collectionGroups';
import {
  PUBLICATION_BIND_HINT,
  groupPublicationStatus,
  publicationActionLabel,
} from './collectionPublication';

const CATALOG = 'cat-1';

const motherResource = (patch: Partial<PublishedMotherResource> = {}): PublishedMotherResource => ({
  schemaVersion: 1,
  criteriaId: motherResourceCriteriaIdOf('perfect'),
  catalogVersion: CATALOG,
  accounts: [],
  revision: 1,
  publishedAt: 1,
  ...patch,
});

const target: StudTargetConfig = {
  kind: 'stud',
  mode: 'perfect',
  catalogVersion: CATALOG,
  slots: [{ groupId: 1, natureId: 2, natureName: '固执', grade: '大婉' }],
};

const studResource = (patch: Partial<PublishedStudResource> = {}): PublishedStudResource => ({
  schemaVersion: 1,
  kind: 'stud',
  mode: 'perfect',
  catalogVersion: CATALOG,
  targetId: studSlotSetIdOf(target),
  targetRevision: 3,
  accounts: [],
  revision: 1,
  publishedAt: 1,
  ...patch,
});

const motherStatus = (input: {
  mother: PublishedMotherResource | null;
  unchanged?: boolean;
  catalogVersion?: string;
}) =>
  groupPublicationStatus({
    type: 'mother',
    mother: input.mother,
    stud: null,
    target: null,
    targetRevision: 0,
    catalogVersion: input.catalogVersion ?? CATALOG,
    unchanged: input.unchanged ?? true,
  });

const studStatus = (input: {
  stud: PublishedStudResource | null;
  targetRevision?: number;
  unchanged?: boolean;
}) =>
  groupPublicationStatus({
    type: 'stud',
    mother: null,
    stud: input.stud,
    target,
    targetRevision: input.targetRevision ?? 3,
    catalogVersion: CATALOG,
    unchanged: input.unchanged ?? true,
  });

describe('小组共享资源发布状态', () => {
  test('没有发布过 → 未发布', () => {
    expect(motherStatus({ mother: null })).toBe('未发布');
    expect(studStatus({ stud: null })).toBe('未发布');
  });

  test('母本：口径与图鉴一致且内容没变 → 已发布', () => {
    expect(motherStatus({ mother: motherResource() })).toBe('已发布');
  });

  test('母本：图鉴变了 / 旧口径摘要 → 需更新', () => {
    expect(motherStatus({ mother: motherResource(), catalogVersion: 'cat-0' })).toBe('需更新');
    expect(motherStatus({ mother: motherResource({ criteriaId: 'mother-v2-x' }) })).toBe('需更新');
    // 组目标里残留的旧口径不再影响：只要摘要自己是「全部母本」就算已发布
    expect(
      groupPublicationStatus({
        type: 'mother',
        mother: motherResource(),
        stud: null,
        target: {
          kind: 'mother',
          criteriaId: 'mother-v2-legacy',
          mode: 'perfect',
          bodies: ['大块头'],
          voices: ['+100'],
          catalogVersion: CATALOG,
        },
        targetRevision: 1,
        catalogVersion: CATALOG,
        unchanged: true,
      }),
    ).toBe('已发布');
  });

  test('导入新数据后本机重建内容不一致 → 需更新（即使口径没变）', () => {
    expect(motherStatus({ mother: motherResource(), unchanged: false })).toBe('需更新');
    expect(studStatus({ stud: studResource(), unchanged: false })).toBe('需更新');
  });

  test('种公：目标集合 / 目标修订 / 图鉴变了 → 需更新', () => {
    expect(studStatus({ stud: studResource() })).toBe('已发布');
    expect(studStatus({ stud: studResource({ targetId: 'stud-other' }) })).toBe('需更新');
    expect(studStatus({ stud: studResource({ targetRevision: 2 }) })).toBe('需更新');
    expect(studStatus({ stud: studResource({ catalogVersion: 'cat-0' }) })).toBe('需更新');
  });
});

/**
 * 2026-11-27：用户说「没找到绑的地方，只登录了」——界面上叫「选号并发布」，
 * 而机器人 ingest 查的是「这个游戏 UID 有没有绑到小组」。同一件事两个词，所以按钮改名。
 */
describe('组卡按钮文案（绑定口径）', () => {
  test('未发布说「绑定」，已发布说「已绑定」，需更新说「更新绑定」', () => {
    expect(publicationActionLabel('未发布', false)).toBe('绑定游戏账号');
    expect(publicationActionLabel('已发布', false)).toBe('已绑定的账号');
    expect(publicationActionLabel('需更新', false)).toBe('更新绑定');
  });

  test('展开编辑时统一是「收起」', () => {
    for (const status of ['未发布', '已发布', '需更新'] as const) {
      expect(publicationActionLabel(status, true)).toBe('收起');
    }
  });

  test('改名后不再用「选号 / 发布」描述这个入口', () => {
    for (const status of ['未发布', '已发布', '需更新'] as const) {
      const label = publicationActionLabel(status, false);
      expect(label).not.toContain('选号');
      expect(label).not.toContain('发布');
    }
  });

  test('按钮下的说明要点明「机器人靠这个同步蛋仓」', () => {
    expect(PUBLICATION_BIND_HINT).toContain('机器人');
    expect(PUBLICATION_BIND_HINT).toContain('蛋仓');
  });
});
