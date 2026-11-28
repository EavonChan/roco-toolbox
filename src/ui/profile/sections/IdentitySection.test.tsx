import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { IdentitySection } from './IdentitySection';
import { makeCtx } from '../testContext';

afterEach(cleanup);

describe('身份区块', () => {
  test('单独渲染：用户名、登录态与头像都在', () => {
    render(<IdentitySection ctx={makeCtx()} />);

    expect(screen.getByTestId('profile-header-name')).toHaveTextContent('训练家小明');
    expect(screen.getByTestId('profile-header-state')).toHaveTextContent('1 个角色');
    expect(screen.getByTestId('profile-header-avatar')).toBeTruthy();
  });

  test('点头像交给上层开弹层；未登录时显示「登录」动作', () => {
    const onOpenAvatar = vi.fn();
    render(<IdentitySection ctx={makeCtx({ onOpenAvatar })} />);
    fireEvent.click(screen.getByTestId('profile-header-avatar'));
    expect(onOpenAvatar).toHaveBeenCalledTimes(1);

    cleanup();
    const onGoIdentity = vi.fn();
    render(
      <IdentitySection ctx={makeCtx({ accountId: null, accountName: null, onGoIdentity })} />,
    );
    fireEvent.click(screen.getByTestId('profile-header-action'));
    expect(onGoIdentity).toHaveBeenCalledTimes(1);
  });

  test('断数据不炸：0 个角色也能渲染', () => {
    render(<IdentitySection ctx={makeCtx({ snapshots: [] })} />);
    expect(screen.getByTestId('profile-header')).toHaveTextContent('还没采集');
  });

  test('头像提示（写云端失败）跟着身份块显示', () => {
    render(
      <IdentitySection
        ctx={makeCtx({ avatarNotice: { tone: 'error', text: '头像没保存成功，已恢复原样' } })}
      />,
    );
    expect(screen.getByTestId('profile-avatar-notice')).toHaveTextContent('已恢复原样');
  });
});
