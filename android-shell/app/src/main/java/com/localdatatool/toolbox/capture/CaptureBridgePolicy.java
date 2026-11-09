package com.localdatatool.toolbox.capture;

/**
 * Caller check shared by the origin-aware WebMessage bridge and its tests.
 *
 * <p>站点 origin 由壳按当前配置传入（默认生产，内测可在设置里切换），
 * 这里只负责和消息来源做严格比较。</p>
 */
public final class CaptureBridgePolicy {
    private CaptureBridgePolicy() {}
    public static boolean allows(String origin, boolean mainFrame, String expectedOrigin) {
        if (!mainFrame || origin == null || expectedOrigin == null) return false;
        return expectedOrigin.equals(origin) || (expectedOrigin + ":443").equals(origin);
    }
}
