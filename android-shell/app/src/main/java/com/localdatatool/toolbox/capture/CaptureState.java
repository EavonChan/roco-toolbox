package com.localdatatool.toolbox.capture;

/** Process-local state; raw files and interruption markers are persisted independently. */
public final class CaptureState {
    public volatile String phase = "idle";
    public volatile String message = "开始前退出游戏，授权后重新登录并查看仓库、背包与蛋仓";
    public volatile long packets, bytes;
    public volatile String fileId = "";
    public volatile long savedBytes;
    /** 采集模式：battle = 附近 / 战斗浮窗发起（允许滚动裁剪）；full = 导入导向。 */
    public volatile String mode = "full";
    public synchronized boolean busy() {
        return "starting".equals(phase) || "capturing".equals(phase) || "stopping".equals(phase);
    }
    public synchronized boolean begin() { return begin("full"); }
    public synchronized boolean begin(String mode) {
        if (busy()) return false;
        this.mode = "battle".equals(mode) ? "battle" : "full";
        packets = bytes = 0;
        fileId = ""; savedBytes = 0;
        phase = "starting"; message = "等待系统 VPN 授权";
        return true;
    }
    public synchronized void update(String phase, String message) { this.message = message; this.phase = phase; }
    public synchronized void packet(int size) { packets++; bytes += size; }
}
