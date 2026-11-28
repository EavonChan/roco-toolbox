import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { CollectSection } from './CollectSection';
import { makeCtx } from '../testContext';

afterEach(cleanup);

describe('采集与同步区块', () => {
  test('有数据：导入入口、本机采集、私有同步都在同一块', () => {
    render(<CollectSection ctx={makeCtx()} />);

    expect(screen.getByTestId('profile-collect')).toBeTruthy();
    expect(screen.getByTestId('import-button')).toBeTruthy();
    expect(screen.getByTestId('profile-sync-block')).toBeTruthy();
    expect(screen.getByTestId('account-panel')).toHaveTextContent('私有同步');
  });

  test('断数据不炸：没有精灵/账号时仍能渲染导入入口', () => {
    render(<CollectSection ctx={makeCtx({ snapshots: [] })} />);
    expect(screen.getByTestId('import-button')).toBeTruthy();
  });
});
