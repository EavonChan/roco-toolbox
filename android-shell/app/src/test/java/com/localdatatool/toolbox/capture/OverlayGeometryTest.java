package com.localdatatool.toolbox.capture;

import org.junit.Test;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/** 悬浮球几何口径（px）：夹紧、初始位置、面板默认落点。 */
public class OverlayGeometryTest {

    private static final int EDGE = 8;

    @Test public void clampKeepsRectInsideScreen() {
        assertArrayEquals(new int[] { 0, 0 }, OverlayGeometry.clamp(-20, -30, 52, 52, 390, 844, 0));
        assertArrayEquals(new int[] { 338, 792 }, OverlayGeometry.clamp(9999, 9999, 52, 52, 390, 844, 0));
        assertArrayEquals(new int[] { 8, 8 }, OverlayGeometry.clamp(0, 0, 52, 52, 390, 844, EDGE));
    }

    @Test public void landscapeScreenAllowsFullWidth() {
        // 横屏 844x390：球可以拖到最右侧，不再被竖屏宽度卡在左半屏
        int[] right = OverlayGeometry.clamp(9999, 200, 52, 52, 844, 390, 0);
        assertEquals(844 - 52, right[0]);
        int[] middle = OverlayGeometry.clamp(600, 200, 52, 52, 844, 390, 0);
        assertEquals(600, middle[0]);
    }

    @Test public void startPositionSitsNearRightEdge() {
        int[] position = OverlayGeometry.startPosition(52, 52, 390, 844, 16, 0.42f);
        assertEquals(390 - 52 - 16, position[0]);
        assertEquals(Math.round(844 * 0.42f), position[1]);
    }

    @Test public void panelOpensOnTheOppositeSideOfTheBall() {
        // 球在左半屏 → 面板贴右边缘
        int[] right = OverlayGeometry.oppositeOfBall(268, 258, 8, 100, 52, 52, 375, 812, EDGE);
        assertEquals(375 - 268 - EDGE, right[0]);
        // 球在右半屏 → 面板贴左边缘
        int[] left = OverlayGeometry.oppositeOfBall(268, 258, 315, 100, 52, 52, 375, 812, EDGE);
        assertEquals(EDGE, left[0]);
    }

    @Test public void panelNeverCoversTheBall() {
        int[][] balls = {
            { 0, 0 }, { 338, 0 }, { 0, 792 }, { 338, 792 }, { 169, 396 }, { 280, 400 }, { 60, 400 }
        };
        for (int[] ball : balls) {
            int[] position = OverlayGeometry.oppositeOfBall(
                268, 300, ball[0], ball[1], 52, 52, 390, 844, EDGE);
            assertFalse(
                "球在 " + ball[0] + "," + ball[1] + " 时面板压住了球",
                OverlayGeometry.overlaps(
                    position[0], position[1], 268, 300, ball[0], ball[1], 52, 52, EDGE));
        }
    }

    @Test public void panelAlwaysStaysOnScreen() {
        int[][] balls = {
            { 0, 0 }, { 338, 0 }, { 0, 792 }, { 338, 792 }, { 169, 396 }
        };
        for (int[] ball : balls) {
            int[] position = OverlayGeometry.oppositeOfBall(
                268, 300, ball[0], ball[1], 52, 52, 390, 844, EDGE);
            assertTrue(position[0] >= EDGE);
            assertTrue(position[1] >= EDGE);
            assertTrue(position[0] + 268 <= 390 - EDGE);
            assertTrue(position[1] + 300 <= 844 - EDGE);
        }
    }

    // ── 方案 A（2026-11-28）：贴球展开、留 12dp；两侧放不下时贴屏边 + 上下错开 ──
    private static final int PANEL_W = 214;
    private static final int PANEL_H = 182;
    private static final int BALL = 52;
    private static final int GAP = 12;

    private static int[] spot(int ballX, int ballY, int screenW, int screenH) {
        return OverlayGeometry.panelSpot(
            PANEL_W, PANEL_H, ballX, ballY, BALL, BALL, screenW, screenH, GAP);
    }

    @Test public void panelSitsBesideBallWithTwelveDpGap() {
        // 375：球贴左边缘（x=0）→ 面板在球的右侧，x = 0 + 52 + 12
        assertArrayEquals(new int[] { 64, 340 }, spot(0, 340, 375, 812));
        // 375：球贴右边缘（x=323）→ 面板在球的左侧，x = 323 - 12 - 214
        assertArrayEquals(new int[] { 97, 340 }, spot(323, 340, 375, 812));
        // 390：球贴右边缘（x=338）→ x = 338 - 12 - 214
        assertArrayEquals(new int[] { 112, 340 }, spot(338, 340, 390, 844));
    }

    @Test public void panelNeverOverlapsBallInAnyPosition() {
        int[][] balls = {
            { 0, 340 }, { 323, 340 }, { 323, 8 }, { 0, 700 }, { 323, 700 },
            { 161, 340 }, { 161, 60 }, { 161, 700 }
        };
        for (int[] ball : balls) {
            int[] position = spot(ball[0], ball[1], 375, 812);
            assertFalse(
                "球在 " + ball[0] + "," + ball[1] + " 时面板压住了球",
                OverlayGeometry.overlaps(
                    position[0], position[1], PANEL_W, PANEL_H,
                    ball[0], ball[1], BALL, BALL, GAP));
            assertTrue("面板必须留在屏内", position[0] >= GAP);
            assertTrue("面板必须留在屏内", position[1] >= GAP);
            assertTrue("面板必须留在屏内", position[0] + PANEL_W <= 375 - GAP);
            assertTrue("面板必须留在屏内", position[1] + PANEL_H <= 812 - GAP);
        }
    }

    @Test public void panelFollowsBallOnTheSameSide() {
        // 球贴右、只上下移动：面板 x 不变，纵向跟着球
        int[] top = spot(323, 120, 375, 812);
        int[] bottom = spot(323, 560, 375, 812);
        assertEquals(top[0], bottom[0]);
        assertEquals(120, top[1]);
        assertEquals(560, bottom[1]);
        // 仍在右半屏、只是往里挪：面板仍然贴球左侧，横向一起跟
        int[] moved = spot(280, 560, 375, 812);
        assertEquals(280 - GAP - PANEL_W, moved[0]);
        assertEquals(560, moved[1]);
    }

    @Test public void snapUsesTheVisibleBallEdgeInsteadOfItsCenter() {
        // 旧口径按「球心距边 8dp」：球完全在屏内时球心离边至少 26dp，永远吸不上；
        // 新口径按可见边缘，贴边 / 距边 8px 内都能吸附。
        assertArrayEquals(new int[] { 0, 1 }, OverlayGeometry.snapToEdge(0, BALL, 390, 8));
        assertArrayEquals(new int[] { 0, 1 }, OverlayGeometry.snapToEdge(5, BALL, 390, 8));
        assertArrayEquals(new int[] { 338, 2 }, OverlayGeometry.snapToEdge(338, BALL, 390, 8));
        assertArrayEquals(new int[] { 338, 2 }, OverlayGeometry.snapToEdge(332, BALL, 390, 8));
        // 中间位置不吸
        assertArrayEquals(new int[] { 100, 0 }, OverlayGeometry.snapToEdge(100, BALL, 390, 8));
    }
}
