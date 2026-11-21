import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { DEFAULT_MOTHER_CRITERIA } from '../domain/motherCriteria';
import { getMotherCriteria, setMotherCriteria } from './motherCriteriaStore';
import { setTargetMode } from './targetModeStore';
import { MotherCriteriaMedals } from './MotherCriteriaMedals';

beforeEach(() => {
  setTargetMode('perfect');
  setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA });
});

describe('MotherCriteriaMedals', () => {
  test('与看板使用相同的四种组合奖牌，强制单选且不会清空', () => {
    render(<MotherCriteriaMedals testIdPrefix="mother-criteria" />);

    expect(screen.getByRole('group', { name: '母本达标奖牌组合' })).toHaveClass('grid-cols-4');
    expect(screen.queryByText('体型（空 = 不限）')).toBeNull();
    expect(screen.queryByText('声音（空 = 不限）')).toBeNull();
    // 2026-11-20 本地口径：默认只勾「大婉」，与种公 / 看板一致
    expect(screen.getByTestId('mother-criteria-grade-大婉')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const grade of ['大粗', '小婉', '小粗']) {
      expect(screen.getByTestId(`mother-criteria-grade-${grade}`)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }

    // 点一个 = 换过去，不累加
    fireEvent.click(screen.getByTestId('mother-criteria-grade-小粗'));
    expect(getMotherCriteria().grades).toEqual(['小粗']);
    expect(screen.getByTestId('mother-criteria-grade-小粗')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('mother-criteria-grade-大婉')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // 再点已选中的那个 = 保持选中，不清空（母本页会把全局目标一起写）
    fireEvent.click(screen.getByTestId('mother-criteria-grade-小粗'));
    expect(getMotherCriteria().grades).toEqual(['小粗']);
    expect(screen.getByTestId('mother-criteria-grade-小粗')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('旧数据的多选组合只显示第一个，不会被改写成默认「大婉」', () => {
    setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA, grades: ['小婉', '小粗'] });
    render(<MotherCriteriaMedals testIdPrefix="mother-criteria" />);

    expect(screen.getByTestId('mother-criteria-grade-小婉')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('mother-criteria-grade-小粗')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(getMotherCriteria().grades).toEqual(['小婉', '小粗']);
  });

  test('切换满分 / 双牌时保留已选组合并更新声音条件', () => {
    render(<MotherCriteriaMedals testIdPrefix="mother-criteria" />);
    fireEvent.click(screen.getByTestId('mother-criteria-grade-大粗'));
    fireEvent.click(screen.getByTestId('mother-criteria-mode-medal'));

    expect(getMotherCriteria().grades).toEqual(['大粗']);
    expect(getMotherCriteria().voices).toEqual(['粗嗓门']);
    expect(
      screen.getByTestId('mother-criteria-grade-大婉').querySelectorAll('img')[1],
    ).toHaveAttribute('src', '/ui/medals/1026.png');
  });
});
