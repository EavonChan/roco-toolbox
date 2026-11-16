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
  test('与看板使用相同的四种组合奖牌，并支持多选', () => {
    render(<MotherCriteriaMedals testIdPrefix="mother-criteria" />);

    expect(screen.getByRole('group', { name: '母本达标奖牌组合' })).toHaveClass('grid-cols-4');
    expect(screen.queryByText('体型（空 = 不限）')).toBeNull();
    expect(screen.queryByText('声音（空 = 不限）')).toBeNull();
    for (const grade of ['大婉', '大粗', '小婉', '小粗']) {
      expect(screen.getByTestId(`mother-criteria-grade-${grade}`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }

    fireEvent.click(screen.getByTestId('mother-criteria-grade-大婉'));
    fireEvent.click(screen.getByTestId('mother-criteria-grade-小粗'));
    expect(getMotherCriteria().grades).toEqual(['大粗', '小婉']);
    expect(screen.getByTestId('mother-criteria-grade-大婉')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('mother-criteria-grade-小婉')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('切换满分 / 双牌时保留已选组合并更新声音条件', () => {
    render(<MotherCriteriaMedals testIdPrefix="mother-criteria" />);
    fireEvent.click(screen.getByTestId('mother-criteria-grade-大粗'));
    fireEvent.click(screen.getByTestId('mother-criteria-mode-medal'));

    expect(getMotherCriteria().grades).toEqual(['大婉', '小婉', '小粗']);
    expect(getMotherCriteria().voices).toEqual(['婉转声', '粗嗓门']);
    expect(
      screen.getByTestId('mother-criteria-grade-大婉').querySelectorAll('img')[1],
    ).toHaveAttribute('src', '/ui/medals/1026.png');
  });
});
