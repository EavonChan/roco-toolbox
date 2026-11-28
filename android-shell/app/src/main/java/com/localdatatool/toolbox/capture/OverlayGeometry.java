package com.localdatatool.toolbox.capture;

/**
 * 悬浮球的几何口径（2026-11-08）。
 *
 * <p>悬浮球本体、详情卡、以及展开面板都从这里取「夹紧 / 初始位置 / 面板默认落点」的算法，
 * 避免各写一套。纯整数计算，不依赖 Android，单位统一为**屏幕像素 px**
 * （调用方先把 dp 换算成 px）。</p>
 *
 * <p>屏幕尺寸的唯一来源是 {@link BattleOverlayController#screenSize()}：它按当前旋转取
 * DisplayManager 的真实屏幕尺寸（Activity 退到后台也不会停在旋转前的旧值）。</p>
 */
public final class OverlayGeometry {

    private OverlayGeometry() { }

    /**
     * 把矩形夹进屏幕内，四周至少留 {@code edge}。
     *
     * @return {left, top}
     */
    public static int[] clamp(int x, int y, int width, int height,
                              int screenWidth, int screenHeight, int edge) {
        int minX = Math.max(0, edge);
        int minY = Math.max(0, edge);
        int maxX = Math.max(minX, screenWidth - width - minX);
        int maxY = Math.max(minY, screenHeight - height - minY);
        return new int[] {
            Math.max(minX, Math.min(x, maxX)),
            Math.max(minY, Math.min(y, maxY))
        };
    }

    /**
     * 首次显示位置：贴右侧、按屏幕高度比例放垂直位置，然后夹紧。
     *
     * @param verticalRatio 0~1，例如 0.42 表示从顶部往下 42% 处
     * @return {left, top}
     */
    public static int[] startPosition(int width, int height,
                                      int screenWidth, int screenHeight,
                                      int edge, float verticalRatio) {
        int right = Math.max(0, screenWidth - width - edge);
        int top = Math.round(screenHeight * Math.max(0f, Math.min(1f, verticalRatio)));
        return clamp(right, top, width, height, screenWidth, screenHeight, edge);
    }

    /**
     * 面板 / 详情卡的默认落点：球在哪一侧，就从另一侧展开。
     *
     * <p>只做三条规则，不再逐级试位置：</p>
     * <ol>
     *   <li>横向：球心在左半屏就贴右边缘，在右半屏就贴左边缘；</li>
     *   <li>纵向先对齐球，若横向仍与球重叠，再放到球上方或下方；</li>
     *   <li>最后夹进屏幕（上下都放不下时贴向离球最远的垂直边）。</li>
     * </ol>
     *
     * <p>球本身不动，面板默认不压住球；用户之后可以自己拖面板。</p>
     *
     * @param gap 面板与屏边 / 面板与球之间的间距（px）
     * @return {left, top}
     */
    public static int[] oppositeOfBall(int width, int height,
                                       int ballX, int ballY, int ballWidth, int ballHeight,
                                       int screenWidth, int screenHeight, int gap) {
        int edge = Math.max(0, gap);
        boolean ballOnRight = ballX + ballWidth / 2 >= screenWidth / 2;
        int x = ballOnRight ? edge : screenWidth - width - edge;
        int y = ballY;
        int[] spot = clamp(x, y, width, height, screenWidth, screenHeight, edge);
        x = spot[0];
        y = spot[1];

        if (overlaps(x, y, width, height, ballX, ballY, ballWidth, ballHeight, gap)) {
            int above = ballY - gap - height;
            int below = ballY + ballHeight + gap;
            if (above >= edge) {
                y = above;
            } else if (below + height <= screenHeight - edge) {
                y = below;
            } else {
                // 上下都放不下：贴向离球最远的那条横边，宁可溢出也不压球
                y = ballY + ballHeight / 2 < screenHeight / 2 ? screenHeight - height - edge : edge;
            }
        }

        return clamp(x, y, width, height, screenWidth, screenHeight, edge);
    }

    /**
     * 面板贴球展开（2026-11-28，方案 A）：球在左半屏就放球的右侧，在右半屏就放球的左侧，
     * 与球保持 {@code gap} 的间隙。
     *
     * <p>只负责「一侧放得下」的情形：横向放不下（球在屏幕正中附近）返回 {@code null}，
     * 由 {@link #panelSpot} 退化为 {@link #oppositeOfBall} 的「贴屏边 + 上下错开」。</p>
     *
     * @return {left, top}；横向放不下时返回 {@code null}
     */
    public static int[] besideBall(int width, int height,
                                   int ballX, int ballY, int ballWidth, int ballHeight,
                                   int screenWidth, int screenHeight, int gap) {
        int edge = Math.max(0, gap);
        boolean ballOnRight = ballX + ballWidth / 2 >= screenWidth / 2;
        int x = ballOnRight ? ballX - gap - width : ballX + ballWidth + gap;
        if (x < edge || x + width > screenWidth - edge) return null;
        return clamp(x, ballY, width, height, screenWidth, screenHeight, edge);
    }

    /**
     * 悬浮面板的默认落点（方案 A / 2026-11-28）：
     * <ol>
     *   <li>优先贴球展开（{@link #besideBall}，间隙 12dp）；</li>
     *   <li>球在屏幕正中、左右都放不下 → 退化为 {@link #oppositeOfBall}：
     *       贴屏边，再上下错开，保证不压球。</li>
     * </ol>
     *
     * @return {left, top}
     */
    public static int[] panelSpot(int width, int height,
                                  int ballX, int ballY, int ballWidth, int ballHeight,
                                  int screenWidth, int screenHeight, int gap) {
        int[] beside = besideBall(width, height, ballX, ballY, ballWidth, ballHeight,
            screenWidth, screenHeight, gap);
        if (beside != null) return beside;
        return oppositeOfBall(width, height, ballX, ballY, ballWidth, ballHeight,
            screenWidth, screenHeight, gap);
    }

    /**
     * 拖拽结束的吸边判定（2026-11-28 修）。
     *
     * <p>旧口径按「球心距屏幕边 8dp」判断，但 {@code clamp} 会保证球完整留在屏内，
     * 球心离边至少半个球宽（26dp），条件永远不成立 —— 吸附 / 向左展开的分支从没执行过。
     * 现在按**球可见边缘**判断：球左边距 ≤ threshold 吸左，球右边距 ≤ threshold 吸右。</p>
     *
     * @return {吸附后的 x, side}；side：0 = 未吸附，1 = 左边缘，2 = 右边缘
     */
    public static int[] snapToEdge(int ballX, int ballWidth, int screenWidth, int threshold) {
        int safeThreshold = Math.max(0, threshold);
        if (ballX <= safeThreshold) return new int[] { 0, 1 };
        if (ballX + ballWidth >= screenWidth - safeThreshold) {
            return new int[] { screenWidth - ballWidth, 2 };
        }
        return new int[] { ballX, 0 };
    }

    /** 两个矩形是否相交（含间距）。 */
    public static boolean overlaps(int x, int y, int width, int height,
                                   int otherX, int otherY, int otherWidth, int otherHeight, int gap) {
        return x < otherX + otherWidth + gap && x + width > otherX - gap
            && y < otherY + otherHeight + gap && y + height > otherY - gap;
    }
}
