import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { CollectSection } from './CollectSection';
import { makeCtx } from '../testContext';

afterEach(cleanup);

describe('采集与同步区块', () => {
  test('有数据：入库反馈、本机采集、私有同步都在同一块，文件导入不再出现', () => {
    render(<CollectSection ctx={makeCtx()} />);

    expect(screen.getByTestId('profile-collect')).toBeTruthy();
    expect(screen.getByTestId('profile-sync-block')).toBeTruthy();
    expect(screen.getByTestId('account-panel')).toHaveTextContent('私有同步');
    // 文件导入 / 合并导入 / 导入历史入口已删除
    expect(screen.queryByTestId('import-button')).toBeNull();
    expect(screen.queryByTestId('import-input')).toBeNull();
    expect(screen.queryByTestId('import-more')).toBeNull();
  });

  test('断数据不炸：没有精灵/账号时仍能渲染同步入口', () => {
    render(<CollectSection ctx={makeCtx({ snapshots: [] })} />);
    expect(screen.getByTestId('profile-sync-block')).toBeTruthy();
    expect(screen.queryByTestId('import-button')).toBeNull();
  });
});
