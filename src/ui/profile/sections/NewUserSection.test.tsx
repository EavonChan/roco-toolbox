import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { NewUserSection } from './NewUserSection';
import { makeCtx } from '../testContext';

afterEach(cleanup);

/** 新用户空态：一句空态 + 一个导入动作（RUI-03：不要四块都在说「还没有数据」）。 */
describe('新用户空态区块', () => {
  test('只有一句空态 + 导入按钮，设置类内容不出现', () => {
    render(<NewUserSection ctx={makeCtx({ loaded: true, snapshots: [] })} />);

    expect(screen.getByTestId('profile-new-user-empty')).toHaveTextContent('还没有导入数据');
    expect(screen.getByTestId('import-button')).toHaveTextContent('导入游戏数据');
    expect(screen.getByTestId('import-input')).toBeTruthy();
    // 隐私开关 / 导出重置 / 数据来源：设置类，空态里不出现
    expect(screen.queryByTestId('analytics-toggle')).toBeNull();
    expect(screen.queryByTestId('import-more')).toBeNull();
    expect(screen.queryByTestId('import-empty')).toBeNull();
  });
});
