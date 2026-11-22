import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  DEFAULT_MOTHER_CRITERIA,
} from '../domain/motherCriteria';
import { CollectionTargetEditor } from './CollectionTargetEditor';
import { getCoverageFilter, resetCoverageFilter, setTargetGrade } from './coverageFilterStore';
import { getMotherCriteria, setMotherCriteria } from './motherCriteriaStore';
import { setTargetMode } from './targetModeStore';

beforeEach(() => {
  resetCoverageFilter();
  setTargetGrade('大婉');
  setTargetMode('perfect');
  setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA });
});

const renderEditor = (section: 'studs' | 'mothers') => {
  render(<CollectionTargetEditor open section={section} onClose={() => {}} />);
};

describe('CollectionTargetEditor', () => {
  test('种公设置弹层只编辑蛋组和性格，不重复提供模式或奖牌组合', () => {
    renderEditor('studs');
    expect(screen.getByRole('dialog', { name: '调整目标' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: '目标模式' })).toBeNull();
    expect(screen.queryByRole('group', { name: '目标奖牌组合（公母共用）' })).toBeNull();
    const motherBefore = { ...getMotherCriteria() };
    const gradesBefore = [...getCoverageFilter().grades];

    fireEvent.click(screen.getByTestId('editor-group-2'));
    expect(getCoverageFilter().groupIds).not.toContain(2);
    expect(getCoverageFilter().grades).toEqual(gradesBefore);
    expect(getMotherCriteria()).toEqual(motherBefore);
  });

  test('母本分区：组合奖牌写回原 store（单选），种公目标不变', () => {
    renderEditor('mothers');
    expect(screen.getByRole('dialog', { name: '调整母本达标条件' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '种公目标' })).toBeNull();
    const gradesBefore = [...getCoverageFilter().grades];

    // 点另一个档位是「换过去」，不是累加
    fireEvent.click(screen.getByTestId('editor-mother-grade-小婉'));
    expect(getMotherCriteria().grades).toEqual(['小婉']);

    expect(getCoverageFilter().grades).toEqual(gradesBefore);
  });

  test('组合奖牌强制单选：换档位只留最后点的那个，再点已选中的不清空', () => {
    renderEditor('mothers');
    fireEvent.click(screen.getByTestId('editor-mother-grade-大粗'));
    expect(getMotherCriteria().grades).toEqual(['大粗']);

    fireEvent.click(screen.getByTestId('editor-mother-grade-小粗'));
    expect(getMotherCriteria().grades).toEqual(['小粗']);

    // 2026-11-22 口径：再点已选中的那个保持选中，不再清空
    fireEvent.click(screen.getByTestId('editor-mother-grade-小粗'));
    expect(getMotherCriteria().grades).toEqual(['小粗']);
    expect(screen.getByTestId('editor-mother-grade-小粗')).toHaveAttribute('aria-pressed', 'true');

    // 恢复默认按钮才把它改回「未设置组合」
    fireEvent.click(screen.getByTestId('editor-reset-mothers'));
    expect(getMotherCriteria().voices).toEqual(DEFAULT_MOTHER_CRITERIA.voices);
    expect(getMotherCriteria().grades).toBeUndefined();
  });

  test('母本达标模式切换更新组合奖牌图标与声音条件', () => {
    renderEditor('mothers');
    // 新口径（2026-11-22）：未设置组合时默认落在「大婉」，满分模式的声音图标是 MAX 缎带
    const perfectVoice = screen.getByTestId('editor-mother-grade-大婉').querySelectorAll('img')[1];
    expect(perfectVoice).toHaveAttribute('src', '/ui/medals/1026-max.png');

    // 明确选一档再切模式：store 里存的是规范值（追满分 = +100 / -100），切到双牌后按双牌语义映射
    fireEvent.click(screen.getByTestId('editor-mother-grade-大粗'));
    expect(getMotherCriteria().voices).toEqual(['-100']);

    fireEvent.click(screen.getByTestId('editor-mother-mode-medal'));
    expect(getMotherCriteria().voices).toEqual(['粗嗓门']);
    expect(
      screen.getByTestId('editor-mother-grade-大粗').querySelectorAll('img')[1]?.getAttribute('src'),
    ).not.toContain('max');
  });

  test('双牌模式下恢复默认会恢复双牌声音条件', () => {
    renderEditor('mothers');
    fireEvent.click(screen.getByTestId('editor-mother-mode-medal'));
    fireEvent.click(screen.getByTestId('editor-reset-mothers'));
    expect(getMotherCriteria().voices).toEqual(['婉转声', '粗嗓门']);
  });

  test('种公恢复默认：蛋组/性格回默认，主页奖牌组合保持不变', () => {
    renderEditor('studs');
    fireEvent.click(screen.getByTestId('editor-group-2'));
    expect(getCoverageFilter().groupIds).toHaveLength(13);

    fireEvent.click(screen.getByTestId('editor-reset-studs'));
    expect(getCoverageFilter().groupIds).toHaveLength(14);
    expect(getCoverageFilter().grades).toEqual(['大婉']);
  });
});
