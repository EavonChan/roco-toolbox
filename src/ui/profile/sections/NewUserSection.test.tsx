import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { NewUserSection } from './NewUserSection';
import { makeCtx } from '../testContext';

afterEach(cleanup);

/** 新用户空态：一句事实 + 登录同步入口（CLEAN2：文件导入已删除）。 */
describe('新用户空态区块', () => {
  test('只有一句空态 + 登录同步入口，文件导入与设置类内容不出现', () => {
    render(<NewUserSection ctx={makeCtx({ loaded: true, snapshots: [] })} />);

    expect(screen.getByTestId('profile-new-user-empty')).toHaveTextContent('还没有数据');
    expect(screen.getByTestId('profile-new-user-empty')).toHaveTextContent(
      '到电脑版或安卓版采集一次，或登录同一账号同步',
    );
    expect(screen.getByTestId('profile-new-user-sync')).toBeTruthy();
    expect(screen.getByTestId('account-panel')).toHaveTextContent('私有同步');
    // 文件导入 / 隐私开关 / 导出：都不在空态里
    expect(screen.queryByTestId('import-button')).toBeNull();
    expect(screen.queryByTestId('import-input')).toBeNull();
    expect(screen.queryByTestId('analytics-toggle')).toBeNull();
    expect(screen.queryByTestId('import-more')).toBeNull();
  });
});
