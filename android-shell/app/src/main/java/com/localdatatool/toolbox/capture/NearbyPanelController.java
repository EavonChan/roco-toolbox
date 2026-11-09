package com.localdatatool.toolbox.capture;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.SystemClock;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.style.ReplacementSpan;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * 「附近」悬浮面板（2026-11-08）。
 *
 * <p>只负责面板本身：展开后的命中区、标题行、内嵌网页小地图、精灵列表与脚注。
 * 球的图标 / 拖动 / 夹取仍由 {@link BattleOverlayController} 负责，本类通过
 * {@link #setOrbRect(int, int, int, int, int)} 拿球当前的屏幕坐标，只在**首次展开**时
 * 按「球在哪一侧就从另一侧展开」算一个不压住球的落点（{@link OverlayGeometry#oppositeOfBall}）。</p>
 *
 * <p>面板可拖动（按住标题栏 / 空白区 / 地图 / 列表空白），松手把位置写进 SharedPreferences，下次展开沿用；
 * 展开落点、松手、旋转后会做一次**简单智能避让**：面板压在球上时挪到位移最小的一侧
 * （{@link OverlayGeometry#avoid}），拖动过程中只夹屏幕，避免面板在球旁边跳动。
 * 列表内容不满一屏时滚动容器不吃触摸，按在列表上也能拖面板。</p>
 */
public final class NearbyPanelController {

    private static final int CARD_RADIUS_DP = 12;
    private static final int TITLE_HEIGHT_DP = 14;
    private static final int MAP_RADIUS_DP = 8;
    private static final int ROW_RADIUS_DP = 6;
    private static final int TAG_RADIUS_DP = 3;
    /** 面板位置存档：拖过一次后，下次展开沿用。 */
    private static final String PREFS = "nearby-panel";
    private static final String KEY_PANEL_X = "x";
    private static final String KEY_PANEL_Y = "y";
    private static final int DRAG_SLOP_DP = 4;

    /** 列表里独立成标签的「体型」牌子。 */
    private static final String[] BODY_KINDS = { "big", "small" };
    /** 列表里独立成标签的「声音」牌子。 */
    private static final String[] VOICE_KINDS = { "high", "low" };
    private static final java.util.Map<String, String> KIND_LABEL = new java.util.HashMap<>();
    private static final java.util.Map<String, String> KIND_COLOR = new java.util.HashMap<>();

    static {
        KIND_LABEL.put("pollution", "污染");
        KIND_LABEL.put("shiny", "异色");
        KIND_LABEL.put("colorful", "炫彩");
        KIND_LABEL.put("big", "大块头");
        KIND_LABEL.put("small", "小不点");
        KIND_LABEL.put("high", "婉转声");
        KIND_LABEL.put("low", "粗嗓门");
        KIND_COLOR.put("pollution", "#7c3aed");
        KIND_COLOR.put("shiny", "#f59e0b");
        KIND_COLOR.put("colorful", "#ec4899");
        KIND_COLOR.put("big", "#0ea5e9");
        KIND_COLOR.put("small", "#0ea5e9");
        KIND_COLOR.put("high", "#059669");
        KIND_COLOR.put("low", "#059669");
    }

    private final Activity activity;
    private final WindowManager windowManager;
    private final SharedPreferences prefs;
    private final String catalogJson;

    private JSONObject nearbyPayload;
    private JSONObject battlePayload;
    private boolean expanded;

    private FrameLayout panel;
    private WindowManager.LayoutParams panelParams;
    private LinearLayout hitBox;
    private TextView hitRow1;
    private TextView hitRow2;
    private TextView hitEmpty;
    private LinearLayout titleRow;
    private TextView titleText;
    private TextView estimatedBadge;
    private FrameLayout mapBox;
    private WebView mapView;
    private boolean mapReady;
    /** 列表外层滚动容器：高度与小地图对齐，超出上下滑动（2026-11-09） */
    private PanelScrollView listScroll;
    private LinearLayout listBox;
    /** 列表内容签名：不变就不重建行，否则每秒推送都会打断滑动（2026-11-09） */
    private String listSignature;
    private TextView footView;
    private boolean hasOrbRect;
    private int lastOrbX;
    private int lastOrbY;
    private int lastOrbSize;
    private int lastScreenWidth;
    private int lastScreenHeight;
    /** 本次展开是否已经定过落点；用户拖过之后不再按默认规则重算 */
    private boolean positioned;
    private float downRawX;
    private float downRawY;
    private int dragStartX;
    private int dragStartY;
    private boolean dragging;

    public NearbyPanelController(Activity activity) {
        this.activity = activity;
        // 必须用 Application 的 WindowManager：Activity 的 WindowManager 带着 Activity
        // 窗口令牌，窗口会被限制在 Activity 的显示区域里（竖屏宽度），横屏游戏里就表现为
        // 「只能拖到左半屏」。球和面板统一走这一份。
        this.windowManager = (WindowManager) activity.getApplicationContext()
            .getSystemService(Context.WINDOW_SERVICE);
        this.prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        this.lastScreenWidth = activity.getResources().getDisplayMetrics().widthPixels;
        this.lastScreenHeight = activity.getResources().getDisplayMetrics().heightPixels;
        String catalog = readAsset("maps/maps.json");
        this.catalogJson = catalog;
    }

    /** 网页推来的附近 payload（含 panels 配置）；返回给网页的结果固定是 ok。 */
    public String updateNearby(JSONObject payload) {
        perfCount(0);
        nearbyPayload = payload;
        if (nearbyPayload == null || !nearbyPayload.optBoolean("visible", false)) {
            collapse();
            return "ok";
        }
        if (expanded) render();
        return "ok";
    }

    /** 战斗命中 payload：只用于命中区内容，球本身仍由 BattleOverlayController 画。 */
    public void updateBattle(JSONObject payload) {
        battlePayload = payload;
        if (expanded) render();
    }

    /** 附近数据是否可见（球要不要留着由它和战斗状态共同决定）。 */
    public boolean nearbyVisible() {
        return nearbyPayload != null && nearbyPayload.optBoolean("visible", false);
    }

    /** 网页有没有推过附近数据；没有推过时球点击保持收起。 */
    public boolean hasNearbyData() {
        return nearbyPayload != null;
    }

    public boolean isExpanded() {
        return expanded;
    }

    /** 球点击：有数据才展开；再点收起。 */
    public void toggle() {
        if (!nearbyVisible()) return;
        if (expanded) {
            collapse();
        } else {
            expanded = true;
            if (panel == null) addPanel();
            render();
        }
    }

    /**
     * 记录球当前的位置与屏幕尺寸，供**首次展开**时算「从另一侧展开」的默认落点。
     * 球拖动时只更新记录，不移动已经展开的面板。
     */
    public void setOrbRect(int orbX, int orbY, int orbSize, int screenWidth, int screenHeight) {
        hasOrbRect = true;
        lastOrbX = orbX;
        lastOrbY = orbY;
        lastOrbSize = orbSize;
        lastScreenWidth = screenWidth;
        lastScreenHeight = screenHeight;
    }

    /** 屏幕旋转 / 尺寸变化：把面板夹回新的屏幕范围，不重算默认落点。 */
    public void onScreenChanged(int screenWidth, int screenHeight) {
        lastScreenWidth = screenWidth;
        lastScreenHeight = screenHeight;
        if (panel == null || panelParams == null) return;
        clampPanel();
        safeUpdate();
    }

    /** 权限回来 / 屏幕变化后把已展开的面板重新挂回去。 */
    public void reapply() {
        if (!nearbyVisible() || !expanded) return;
        if (panel == null) addPanel();
        render();
    }

    /**
     * 面板落点：
     * <ul>
     *   <li>用户拖过（有存档）→ 沿用存档位置，只夹回屏幕内；</li>
     *   <li>没拖过 → 按球当前所在侧，从另一侧展开，默认不压住球。</li>
     * </ul>
     * 最后统一走 {@link #clampPanel()}：夹进屏幕并躲开球（存档位置压在球上也会被推开）。
     */
    private void placePanel() {
        if (panel == null || panelParams == null) return;
        if (!positioned) {
            int edge = dp(NearbyOverlayModel.EDGE);
            int savedX = prefs.getInt(KEY_PANEL_X, Integer.MIN_VALUE);
            int savedY = prefs.getInt(KEY_PANEL_Y, Integer.MIN_VALUE);
            int[] spot;
            if (savedX != Integer.MIN_VALUE && savedY != Integer.MIN_VALUE) {
                spot = OverlayGeometry.clamp(savedX, savedY,
                    panelParams.width, panelParams.height,
                    lastScreenWidth, lastScreenHeight, edge);
            } else if (hasOrbRect) {
                spot = OverlayGeometry.oppositeOfBall(
                    panelParams.width, panelParams.height,
                    lastOrbX, lastOrbY, lastOrbSize, lastOrbSize,
                    lastScreenWidth, lastScreenHeight, edge);
            } else {
                spot = OverlayGeometry.startPosition(
                    panelParams.width, panelParams.height,
                    lastScreenWidth, lastScreenHeight, edge, 0.3f);
            }
            panelParams.x = spot[0];
            panelParams.y = spot[1];
            positioned = true;
        }
        // 拖动中每秒的 render → placePanel 只夹屏幕：这时候做避免会把面板从手指下弹开
        if (dragging) {
            clampToScreen();
        } else {
            clampPanel();
        }
        safeUpdate();
    }

    /** 把面板夹进当前屏幕（四边留 {@code EDGE}）。 */
    private void clampToScreen() {
        if (panelParams == null) return;
        int[] spot = OverlayGeometry.clamp(
            panelParams.x, panelParams.y, panelParams.width, panelParams.height,
            lastScreenWidth, lastScreenHeight, dp(NearbyOverlayModel.EDGE));
        panelParams.x = spot[0];
        panelParams.y = spot[1];
    }

    /** 夹进屏幕后躲开球（简单智能避让）：落点、松手、旋转后都用它。 */
    private void clampPanel() {
        if (panelParams == null) return;
        clampToScreen();
        if (!hasOrbRect) return;
        int[] spot = OverlayGeometry.avoid(
            panelParams.x, panelParams.y, panelParams.width, panelParams.height,
            lastOrbX, lastOrbY, lastOrbSize, lastOrbSize,
            lastScreenWidth, lastScreenHeight, dp(NearbyOverlayModel.EDGE));
        panelParams.x = spot[0];
        panelParams.y = spot[1];
    }

    /**
     * 面板拖动：按住标题栏 / 空白区就能拖走，松手记住位置。
     *
     * <p>地图是 WebView，它自己吃掉触摸，所以按在图上不会拖动面板；
     * 面板上的文字标签不消费事件，会把事件冒泡到这里。</p>
     */
    private boolean onPanelTouch(View view, MotionEvent event) {
        if (panelParams == null) return false;
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                downRawX = event.getRawX();
                downRawY = event.getRawY();
                dragStartX = panelParams.x;
                dragStartY = panelParams.y;
                dragging = false;
                return true;
            case MotionEvent.ACTION_MOVE: {
                float dx = event.getRawX() - downRawX;
                float dy = event.getRawY() - downRawY;
                if (!dragging && Math.hypot(dx, dy) < dp(DRAG_SLOP_DP)) return true;
                dragging = true;
                panelParams.x = dragStartX + Math.round(dx);
                panelParams.y = dragStartY + Math.round(dy);
                // 拖动过程中只夹屏幕，不做避让：否则面板会在球旁边一跳一跳
                clampToScreen();
                safeUpdate();
                return true;
            }
            case MotionEvent.ACTION_UP:
                if (dragging) {
                    panelParams.x = dragStartX + Math.round(event.getRawX() - downRawX);
                    panelParams.y = dragStartY + Math.round(event.getRawY() - downRawY);
                    clampPanel();
                    safeUpdate();
                    prefs.edit()
                        .putInt(KEY_PANEL_X, panelParams.x)
                        .putInt(KEY_PANEL_Y, panelParams.y)
                        .apply();
                }
                dragging = false;
                return true;
            case MotionEvent.ACTION_CANCEL:
                dragging = false;
                return true;
            default:
                return false;
        }
    }

    /**
     * 收起面板（窗口摘掉，但保留已加载的网页小地图，下次展开直接复用）。
     */
    public void remove() {
        collapse();
    }

    /** Activity 销毁时彻底释放 WebView。 */
    public void release() {
        collapse();
        destroyMap();
    }

    private void collapse() {
        expanded = false;
        positioned = false;
        dragging = false;
        if (panel == null) return;
        try {
            windowManager.removeView(panel);
        } catch (Exception ignored) {
            // 窗口已经不在：忽略
        }
        panel.removeAllViews();
        panel = null;
        panelParams = null;
        hitBox = null;
        hitRow1 = null;
        hitRow2 = null;
        hitEmpty = null;
        titleRow = null;
        titleText = null;
        estimatedBadge = null;
        mapBox = null;
        listScroll = null;
        listBox = null;
        listSignature = null;
        footView = null;
    }

    private void addPanel() {
        PanelTheme theme = theme();
        FrameLayout root = new FrameLayout(activity);
        root.setBackground(cardBackground(theme));
        root.setClipToOutline(true);

        panelParams = new WindowManager.LayoutParams(
            dp(NearbyOverlayModel.PANEL_WIDTH), dp(NearbyOverlayModel.HIT_HEIGHT),
            overlayType(),
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT);
        panelParams.gravity = Gravity.TOP | Gravity.START;
        panel = root;
        // 面板要能拖动，所以不再加 FLAG_NOT_TOUCHABLE；焦点仍然不抢，
        // 面板以外的触摸照旧交给游戏（FLAG_NOT_TOUCH_MODAL）。
        root.setOnTouchListener(this::onPanelTouch);

        hitBox = buildHitBox(theme);
        titleRow = buildTitleRow(theme);
        mapBox = buildMapBox();
        listBox = new LinearLayout(activity);
        listBox.setOrientation(LinearLayout.VERTICAL);
        // 列表比地图高时在框内上下滑动：高度与小地图对齐，不再把面板拉长
        listScroll = new PanelScrollView(activity);
        listScroll.setVerticalScrollBarEnabled(false);
        listScroll.setFillViewport(true);
        listScroll.setClipToPadding(false);
        listScroll.addView(listBox, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        listSignature = null;
        footView = text("", 9, theme.muted);
        footView.setGravity(Gravity.CENTER_VERTICAL);
        footView.setSingleLine(true);
        footView.setEllipsize(TextUtils.TruncateAt.END);

        root.addView(hitBox, frame(0, 0, NearbyOverlayModel.PANEL_WIDTH, NearbyOverlayModel.HIT_HEIGHT));
        root.addView(titleRow, frame(8, 0, NearbyOverlayModel.PANEL_WIDTH - 16, TITLE_HEIGHT_DP));
        root.addView(mapBox, frame(8, 0, NearbyOverlayModel.MAP_SIZE, NearbyOverlayModel.MAP_SIZE));
        root.addView(listScroll, frame(8, 0, NearbyOverlayModel.PANEL_WIDTH - 16, NearbyOverlayModel.EMPTY_BODY_HEIGHT));
        root.addView(footView, frame(8, 0, NearbyOverlayModel.PANEL_WIDTH - 16, NearbyOverlayModel.FOOT_TEXT_HEIGHT));

        try {
            windowManager.addView(root, panelParams);
        } catch (Exception error) {
            panel = null;
            panelParams = null;
            expanded = false;
        }
    }

    private LinearLayout buildHitBox(PanelTheme theme) {
        LinearLayout box = new LinearLayout(activity);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(8), dp(5), dp(8), dp(6));
        box.setBackground(hitBackground(theme));

        LinearLayout header = new LinearLayout(activity);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = text(NearbyOverlayModel.HIT_TITLE, 11, theme.text);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        TextView chevron = text("⌄", 13, theme.muted);
        chevron.setGravity(Gravity.CENTER);
        chevron.setPadding(dp(2), 0, dp(2), 0);
        header.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1));
        header.addView(chevron, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));
        box.addView(header, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(16)));

        hitRow1 = chipRow(theme);
        hitRow2 = chipRow(theme);
        box.addView(hitRow1, chipRowParams(3));
        box.addView(hitRow2, chipRowParams(3));

        hitEmpty = text(NearbyOverlayModel.HIT_EMPTY_TEXT, 9.5f, theme.muted);
        hitEmpty.setLineSpacing(dpF(1), 1f);
        box.addView(hitEmpty, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return box;
    }

    private TextView chipRow(PanelTheme theme) {
        TextView view = new TextView(activity);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        view.setTextColor(theme.chipText);
        view.setIncludeFontPadding(false);
        view.setSingleLine(true);
        view.setEllipsize(TextUtils.TruncateAt.END);
        view.setGravity(Gravity.CENTER_VERTICAL);
        return view;
    }

    private LinearLayout.LayoutParams chipRowParams(int topMarginDp) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(15));
        params.topMargin = dp(topMarginDp);
        return params;
    }

    private LinearLayout buildTitleRow(PanelTheme theme) {
        LinearLayout row = new LinearLayout(activity);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        titleText = text("", 11, theme.text);
        titleText.setTypeface(Typeface.DEFAULT_BOLD);
        titleText.setSingleLine(true);
        estimatedBadge = text(NearbyOverlayModel.ESTIMATED_BADGE, 9, 0xFFF59E0B);
        estimatedBadge.setGravity(Gravity.CENTER);
        estimatedBadge.setPadding(dp(3), 0, dp(3), 0);
        estimatedBadge.setBackground(badgeBackground());
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, dp(13));
        badgeParams.leftMargin = dp(5);
        row.addView(titleText, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        row.addView(estimatedBadge, badgeParams);
        return row;
    }

    private FrameLayout buildMapBox() {
        FrameLayout box = new FrameLayout(activity);
        box.setBackground(mapBackground());
        box.setClipToOutline(true);
        mapView = createMapView();
        if (mapView != null) {
            box.addView(mapView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        return box;
    }

    private WebView createMapView() {
        try {
            WebView view = new WebView(activity);
            view.setBackgroundColor(Color.TRANSPARENT);
            // 纯展示：不抢焦点、不吃触摸，触摸事件交给下面的游戏
            view.setFocusable(false);
            view.setFocusableInTouchMode(false);
            view.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
            view.setLongClickable(false);
            view.setHapticFeedbackEnabled(false);
            // 地图是纯展示：WebView 自己的触摸不再吞掉，统一交给面板拖动，
            // 这样「按在地图上」也能拖整个面板（2026-11-09）。
            view.setOnTouchListener(this::onPanelTouch);
            WebSettings settings = view.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(false);
            settings.setAllowFileAccess(true);
            // 页面本身是 file:///android_asset，底图 maps/*.webp 也是 file://：
            // 不允许 file 页面读 file 资源时图片会被静默拦截，表现为「地图一片深色」。
            settings.setAllowFileAccessFromFileURLs(true);
            settings.setBlockNetworkLoads(true);
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);
            settings.setUseWideViewPort(false);
            settings.setLoadWithOverviewMode(false);
            settings.setTextZoom(100);
            view.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView webView, String url) {
                    return true;
                }
                @Override public void onPageFinished(WebView webView, String url) {
                    mapReady = true;
                    if (catalogJson != null) {
                        webView.evaluateJavascript(
                            "window.RocoOverlayMap&&window.RocoOverlayMap.init("
                                + JSONObject.quote(catalogJson) + ")", null);
                    }
                    pushMapData();
                }
            });
            view.loadUrl("file:///android_asset/overlay-map.html");
            return view;
        } catch (Exception error) {
            return null;
        }
    }

    private void destroyMap() {
        if (mapView == null) return;
        try {
            mapView.loadUrl("about:blank");
            mapView.removeAllViews();
            mapView.destroy();
        } catch (Exception ignored) {
            // 已经销毁过：忽略
        }
        mapView = null;
        mapReady = false;
    }

    private void render() {
        if (panel == null || panelParams == null) return;
        perfCount(1);
        NearbyOverlayModel model = NearbyOverlayModel.parse(nearbyPayload);
        if (model == null) {
            collapse();
            return;
        }
        PanelTheme theme = theme();
        panel.setBackground(cardBackground(theme));
        hitBox.setBackground(hitBackground(theme));

        boolean showBattle = model.battle;
        boolean hasHit = hasHitFields();
        boolean showNearby = model.nearby;
        int rows = model.shownRows();
        int hidden = model.hiddenCount();
        boolean hasMap = showNearby && showsMapArea(model);
        int hitHeight = !showBattle ? 0 : (hasHit ? NearbyOverlayModel.HIT_HEIGHT : NearbyOverlayModel.HIT_EMPTY_HEIGHT);
        int panelHeight = NearbyOverlayModel.panelHeight(
            showBattle, hasHit, showNearby, rows, hasMap, hidden);

        // ── 命中区 ─────────────────────────────────────
        hitBox.setVisibility(showBattle ? View.VISIBLE : View.GONE);
        if (showBattle) {
            setFrame(hitBox, 0, 0, NearbyOverlayModel.PANEL_WIDTH, hitHeight);
            hitEmpty.setVisibility(hasHit ? View.GONE : View.VISIBLE);
            hitRow1.setVisibility(hasHit ? View.VISIBLE : View.GONE);
            hitRow2.setVisibility(hasHit ? View.VISIBLE : View.GONE);
            if (hasHit) {
                hitRow1.setText(buildChips(theme, battlePayload.optJSONArray("fields"), 1,
                    battlePayload.optBoolean("hit", false)));
                hitRow2.setText(buildChips(theme, battlePayload.optJSONArray("fields"), 2, false));
                hitRow2.setVisibility(hitRow2.length() == 0 ? View.GONE : View.VISIBLE);
            }
        }

        // ── 标题行 ─────────────────────────────────────
        titleRow.setVisibility(showNearby ? View.VISIBLE : View.GONE);
        if (showNearby) {
            titleText.setText(model.titleText());
            titleText.setTextColor(theme.text);
            estimatedBadge.setVisibility(model.selfEstimated ? View.VISIBLE : View.GONE);
            setFrame(titleRow, 8, hitHeight + NearbyOverlayModel.TITLE_TOP_GAP,
                NearbyOverlayModel.PANEL_WIDTH - 16, TITLE_HEIGHT_DP);
        }

        // ── 地图 / 列表 / 脚注 ─────────────────────────
        mapBox.setVisibility(hasMap ? View.VISIBLE : View.GONE);
        listScroll.setVisibility(showNearby ? View.VISIBLE : View.GONE);
        if (showNearby) {
            int bodyTop = hitHeight + NearbyOverlayModel.BODY_TOP_GAP;
            // 列表高度不超过小地图：超出的条数在框内上下滑动，面板不再被列表拉长
            int bodyHeight = hasMap
                ? NearbyOverlayModel.MAP_SIZE
                : Math.min(NearbyOverlayModel.listHeight(rows), NearbyOverlayModel.MAP_SIZE);
            if (hasMap) {
                setFrame(mapBox, 8, bodyTop, NearbyOverlayModel.MAP_SIZE, NearbyOverlayModel.MAP_SIZE);
                setFrame(listScroll, 136, bodyTop, 124, bodyHeight);
            } else {
                setFrame(listScroll, 8, bodyTop, NearbyOverlayModel.PANEL_WIDTH - 16, bodyHeight);
            }
            // 内容签名不变就不重建：每秒推送都 removeAllViews 会把正在滑动的列表打断
            String signature = listSignature(model, rows);
            if (!signature.equals(listSignature)) {
                fillList(theme, model, rows);
                listSignature = signature;
            }
            footView.setVisibility(hidden > 0 ? View.VISIBLE : View.GONE);
            if (hidden > 0) {
                footView.setText(model.footText());
                footView.setTextColor(theme.muted);
                setFrame(footView, 8, panelHeight - 20,
                    NearbyOverlayModel.PANEL_WIDTH - 16, NearbyOverlayModel.FOOT_TEXT_HEIGHT);
            }
            pushMapData(model, hasMap);
        } else {
            footView.setVisibility(View.GONE);
        }

        panelParams.width = dp(NearbyOverlayModel.PANEL_WIDTH);
        panelParams.height = dp(panelHeight);
        placePanel();
    }

    /**
     * 列表内容签名：名称|等级|性别|距离|方向|牌子|命中原因（2026-11-09）。
     * 每秒都推送新 payload，但绝大多数字段没变；签名一致时保留现有行，
     * 用户正在滑动 / 点按就不会被 removeAllViews 打断。
     */
    private static String listSignature(NearbyOverlayModel model, int rows) {
        StringBuilder builder = new StringBuilder();
        builder.append(rows)
            .append(model.waitingLogin() ? 'w' : '-')
            .append(model.noTargets() ? 'n' : '-');
        for (int index = 0; index < rows; index++) {
            NearbyOverlayModel.Pet pet = model.pets.get(index);
            builder.append('#').append(pet.name).append('|')
                .append(pet.level).append('|')
                .append(pet.gender).append('|')
                .append(pet.distanceM == null ? "" : Math.round(pet.distanceM)).append('|')
                .append(pet.bearingArrow).append('|')
                .append(TextUtils.join(",", pet.kinds)).append('|')
                .append(pet.reason).append('|')
                .append(pet.alert ? 'a' : '-')
                .append(pet.rare ? 'r' : '-');
        }
        return builder.toString();
    }

    private void fillList(PanelTheme theme, NearbyOverlayModel model, int rows) {
        perfCount(2);
        listBox.removeAllViews();
        if (rows == 0) {
            listBox.addView(emptyState(theme, model));
            return;
        }
        for (int index = 0; index < rows; index++) {
            NearbyOverlayModel.Pet pet = model.pets.get(index);
            LinearLayout row = new LinearLayout(activity);
            row.setOrientation(LinearLayout.VERTICAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(6), dp(3), dp(6), dp(3));
            row.setBackground(rowBackground(theme, pet));

            // 第一行：名称、性别、等级
            LinearLayout line1 = new LinearLayout(activity);
            line1.setOrientation(LinearLayout.HORIZONTAL);
            line1.setGravity(Gravity.CENTER_VERTICAL);
            TextView name = text(pet.name, 11, theme.text);
            name.setTypeface(Typeface.DEFAULT_BOLD);
            name.setSingleLine(true);
            name.setEllipsize(TextUtils.TruncateAt.END);
            TextView gender = text(genderText(pet), 9, theme.muted);
            gender.setSingleLine(true);
            gender.setPadding(dp(3), 0, 0, 0);
            TextView level = text("Lv" + pet.level, 8.5f, theme.muted);
            level.setSingleLine(true);
            level.setPadding(dp(3), 0, 0, 0);
            line1.addView(name, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            line1.addView(gender, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            line1.addView(level, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            // 第二行：距离 + 方向箭头、体型、声音、命中原因（三者各自一个标签，不再互相顶掉）
            LinearLayout line2 = new LinearLayout(activity);
            line2.setOrientation(LinearLayout.HORIZONTAL);
            line2.setGravity(Gravity.CENTER_VERTICAL);
            TextView meta = text(distanceText(pet), 9, theme.muted);
            meta.setSingleLine(true);
            meta.setEllipsize(TextUtils.TruncateAt.END);
            line2.addView(meta, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            TextView bodyTag = kindTag(pet, BODY_KINDS);
            if (bodyTag != null) line2.addView(bodyTag);
            TextView voiceTag = kindTag(pet, VOICE_KINDS);
            if (voiceTag != null) line2.addView(voiceTag);
            TextView reasonTag = reasonTag(pet);
            if (reasonTag != null) line2.addView(reasonTag);

            LinearLayout.LayoutParams line1Params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            LinearLayout.LayoutParams line2Params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            line2Params.topMargin = dp(1);
            row.addView(line1, line1Params);
            row.addView(line2, line2Params);

            LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(NearbyOverlayModel.ROW_HEIGHT));
            if (index > 0) rowParams.topMargin = dp(NearbyOverlayModel.ROW_GAP);
            listBox.addView(row, rowParams);
        }
    }

    /** 性别缺失显示「—」，不显示空位。 */
    private static String genderText(NearbyOverlayModel.Pet pet) {
        if ("公".equals(pet.gender)) return "♂";
        if ("母".equals(pet.gender)) return "♀";
        return "—";
    }

    private View emptyState(PanelTheme theme, NearbyOverlayModel model) {
        boolean waitingLogin = model.waitingLogin();
        LinearLayout box = new LinearLayout(activity);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        boolean noTargets = model.noTargets();
        TextView main = text(
            waitingLogin ? NearbyOverlayModel.WAITING_LOGIN
                : noTargets ? NearbyOverlayModel.EMPTY_TARGET_TITLE
                : NearbyOverlayModel.EMPTY_NEARBY_TITLE,
            10, theme.muted);
        main.setGravity(Gravity.CENTER);
        box.addView(main);
        if (!waitingLogin) {
            TextView hint = text(
                noTargets ? NearbyOverlayModel.EMPTY_TARGET_HINT : NearbyOverlayModel.EMPTY_NEARBY_HINT,
                9, theme.muted);
            hint.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            params.topMargin = dp(3);
            box.addView(hint, params);
        }
        box.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return box;
    }

    /** 体型牌子：独立成一个标签，不再和声音 / 命中原因挤在同一段里被替换。 */
    private TextView kindTag(NearbyOverlayModel.Pet pet, String[] keys) {
        String label = null;
        String color = null;
        for (String key : keys) {
            if (!pet.kinds.contains(key)) continue;
            String text = KIND_LABEL.get(key);
            if (text == null) continue;
            label = label == null ? text : label + "·" + text;
            if (color == null) color = KIND_COLOR.get(key);
        }
        return label == null ? null : buildTag(label, color == null ? "#475569" : color);
    }

    /**
     * 命中原因标签：需求（绿）> 提醒（红）> 稀有（橙）> 炫彩 / 异色 / 污染（原牌子色）。
     * 与体型 / 声音并列显示，不再互相顶掉。
     */
    private TextView reasonTag(NearbyOverlayModel.Pet pet) {
        String reason = pet.reason == null ? "" : pet.reason;
        if (reason.isEmpty()) {
            if (pet.alert) reason = "alert";
            else if (pet.rare) reason = "rare";
        }
        if (reason.isEmpty()) return null;
        switch (reason) {
            case "demand":
                return buildTag("需求", "#16a34a");
            case "alert":
                return buildTag("提醒", "#f43f5e");
            case "rare":
                return buildTag("稀有", "#d97706");
            default: {
                String label = KIND_LABEL.get(reason);
                return label == null ? null : buildTag(label, kindColor(reason));
            }
        }
    }

    private TextView buildTag(String label, String color) {
        TextView tag = text(label, 8, Color.parseColor(color));
        tag.setSingleLine(true);
        tag.setGravity(Gravity.CENTER);
        tag.setPadding(dp(3), 0, dp(3), 0);
        tag.setBackground(tagBackground(Color.parseColor(color)));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, dp(11));
        params.leftMargin = dp(3);
        tag.setLayoutParams(params);
        return tag;
    }

    private CharSequence buildChips(PanelTheme theme, JSONArray fields, int row, boolean hit) {
        SpannableStringBuilder builder = new SpannableStringBuilder();
        if (fields != null) {
            for (int index = 0; index < fields.length(); index++) {
                JSONObject field = fields.optJSONObject(index);
                if (field == null) continue;
                if (field.optInt("row", 1) != row) continue;
                String value = field.optString("text", "");
                if (value.isEmpty()) continue;
                int background = field.optBoolean("primary", false)
                    ? theme.chipPrimaryBg
                    : field.optBoolean("hot", false) ? theme.chipHotBg : theme.chipBg;
                int foreground = field.optBoolean("primary", false)
                    ? theme.chipPrimaryText
                    : field.optBoolean("hot", false) ? theme.chipHotText : theme.chipText;
                appendChip(builder, value, background, foreground);
            }
        }
        if (row == 1 && hit) appendChip(builder, "命中目标", 0xFFF43F5E, Color.WHITE);
        return builder;
    }

    private void appendChip(SpannableStringBuilder builder, String value, int background, int foreground) {
        if (builder.length() > 0) builder.append(' ');
        int start = builder.length();
        builder.append(value);
        int end = builder.length();
        builder.setSpan(new ChipSpan(background, foreground, dpF(4), dp(4), dp(1)),
            start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
    }

    private boolean hasHitFields() {
        if (battlePayload == null) return false;
        JSONArray fields = battlePayload.optJSONArray("fields");
        if (fields == null || fields.length() == 0) return false;
        for (int index = 0; index < fields.length(); index++) {
            JSONObject field = fields.optJSONObject(index);
            if (field != null && !field.optString("text", "").isEmpty()) return true;
        }
        return false;
    }

    /**
     * 有自身坐标就出「地图区」：有标定的场景画地图，没标定的场景由 WebView 切雷达模式。
     * 以前要求 scene 必须在 maps.json 里，没标定就直接掉成纯列表，看不到方位。
     */
    private boolean showsMapArea(NearbyOverlayModel model) {
        if (mapView == null) return false;
        if (model.selfX != null && model.selfY != null) return true;
        // 307 稀疏：自身坐标暂时缺失时，只要还有带坐标的精灵就照样出地图 / 雷达，
        // 中心用最近一只兜底，避免传送后整块地图消失（2026-11-10）
        for (NearbyOverlayModel.Pet pet : model.mapPets) {
            if (pet.x != null && pet.y != null) return true;
        }
        return false;
    }

    // ── 卡顿量化（2026-11-10）：只记数不优化，5s 打一行，先看真实热点在哪 ──
    private int perfUpdates;
    private int perfRenders;
    private int perfListFills;
    private int perfLayouts;
    private int perfMapPushes;
    private long perfSince = SystemClock.elapsedRealtime();

    private void perfCount(int kind) {
        if (kind == 0) perfUpdates++;
        else if (kind == 1) perfRenders++;
        else if (kind == 2) perfListFills++;
        else if (kind == 3) perfLayouts++;
        else perfMapPushes++;
        long now = SystemClock.elapsedRealtime();
        if (now - perfSince < 5000L) return;
        Log.d("RocoPerf", "nearby 5s update=" + perfUpdates + " render=" + perfRenders
            + " fillList=" + perfListFills + " updateViewLayout=" + perfLayouts
            + " mapPush=" + perfMapPushes);
        perfUpdates = 0;
        perfRenders = 0;
        perfListFills = 0;
        perfLayouts = 0;
        perfMapPushes = 0;
        perfSince = now;
    }

    private void pushMapData() {
        if (nearbyPayload == null) return;
        NearbyOverlayModel model = NearbyOverlayModel.parse(nearbyPayload);
        pushMapData(model, model != null && showsMapArea(model));
    }

    private void pushMapData(NearbyOverlayModel model, boolean visible) {
        if (mapView == null || !mapReady || model == null || !visible) return;
        perfCount(4);
        try {
            // selfX 为 null 时 JSONObject.put 会直接删掉这个键，网页侧拿不到中心就不会画点；
            // 这里用最近一只带坐标的精灵兜底，并把「估算」标上（2026-11-10）
            Double selfX = model.selfX;
            Double selfY = model.selfY;
            boolean estimated = model.selfEstimated;
            if (selfX == null || selfY == null) {
                for (NearbyOverlayModel.Pet pet : model.mapPets) {
                    if (pet.x != null && pet.y != null) {
                        selfX = pet.x;
                        selfY = pet.y;
                        estimated = true;
                        break;
                    }
                }
            }
            if (selfX == null || selfY == null) return;
            JSONObject data = new JSONObject();
            data.put("scene", model.scene);
            data.put("self", new JSONObject().put("x", selfX).put("y", selfY));
            data.put("estimated", estimated);
            JSONArray pets = new JSONArray();
            // 地图要画全部附近精灵（普通精灵也在雷达上），列表只展示命中目标
            for (NearbyOverlayModel.Pet pet : model.mapPets) {
                if (pet.x == null || pet.y == null) continue;
                JSONObject item = new JSONObject();
                item.put("x", pet.x);
                item.put("y", pet.y);
                item.put("rare", pet.rare);
                item.put("alert", pet.alert);
                item.put("reason", pet.reason);
                item.put("kinds", new JSONArray(pet.kinds));
                pets.put(item);
            }
            data.put("pets", pets);
            String json = data.toString();
            mapView.evaluateJavascript(
                "window.RocoOverlayMap&&window.RocoOverlayMap.update(" + JSONObject.quote(json) + ")", null);
        } catch (Exception ignored) {
            // 地图数据坏掉时保留上一帧，不影响列表
        }
    }

    /** 距离 + 方向：有箭头用箭头（↑↗→↘↓↙←↖），旧 payload 退回方位文字。 */
    private static String distanceText(NearbyOverlayModel.Pet pet) {
        String distance = pet.distanceM == null ? "—" : Math.round(pet.distanceM) + "m";
        String direction = pet.bearingArrow == null || pet.bearingArrow.isEmpty()
            ? pet.bearingLabel : pet.bearingArrow;
        if (direction == null || direction.isEmpty()) return distance;
        return distance + " " + direction;
    }

    private static String kindColor(String kind) {
        String color = KIND_COLOR.get(kind);
        return color == null ? "#475569" : color;
    }

    private void safeUpdate() {
        if (panel == null || panelParams == null) return;
        perfCount(3);
        try {
            windowManager.updateViewLayout(panel, panelParams);
        } catch (Exception ignored) {
            // 窗口还没加上 / 已移除：下次渲染再试
        }
    }

    private TextView text(String value, float sizeSp, int color) {
        TextView view = new TextView(activity);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
        view.setTextColor(color);
        view.setIncludeFontPadding(false);
        return view;
    }

    private FrameLayout.LayoutParams frame(int leftDp, int topDp, int widthDp, int heightDp) {
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(widthDp), dp(heightDp));
        params.leftMargin = dp(leftDp);
        params.topMargin = dp(topDp);
        return params;
    }

    private void setFrame(View view, int leftDp, int topDp, int widthDp, int heightDp) {
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) view.getLayoutParams();
        if (params == null) params = new FrameLayout.LayoutParams(dp(widthDp), dp(heightDp));
        params.leftMargin = dp(leftDp);
        params.topMargin = dp(topDp);
        params.width = dp(widthDp);
        params.height = dp(heightDp);
        view.setLayoutParams(params);
    }

    private GradientDrawable cardBackground(PanelTheme theme) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(theme.panelBg);
        drawable.setCornerRadius(dpF(CARD_RADIUS_DP));
        drawable.setStroke(dp(1), theme.line);
        return drawable;
    }

    private GradientDrawable hitBackground(PanelTheme theme) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(theme.hitBg);
        drawable.setCornerRadii(new float[] {
            dpF(CARD_RADIUS_DP), dpF(CARD_RADIUS_DP),
            dpF(CARD_RADIUS_DP), dpF(CARD_RADIUS_DP), 0, 0, 0, 0 });
        return drawable;
    }

    private GradientDrawable rowBackground(PanelTheme theme, NearbyOverlayModel.Pet pet) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setCornerRadius(dpF(ROW_RADIUS_DP));
        drawable.setColor(pet.alert ? theme.alertBg : theme.row);
        drawable.setStroke(dp(1), pet.alert ? theme.alertLine : pet.rare ? theme.rareLine : theme.line);
        return drawable;
    }

    private GradientDrawable tagBackground(int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setCornerRadius(dpF(TAG_RADIUS_DP));
        drawable.setColor(withAlpha(color, 0.18f));
        return drawable;
    }

    private GradientDrawable badgeBackground() {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setCornerRadius(dpF(4));
        drawable.setColor(0x1AF59E0B);
        drawable.setStroke(dp(1), 0x55F59E0B);
        return drawable;
    }

    private GradientDrawable mapBackground() {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setCornerRadius(dpF(MAP_RADIUS_DP));
        drawable.setColor(0xFF0D1A26);
        return drawable;
    }

    private static int withAlpha(int color, float alpha) {
        return Color.argb(Math.round(alpha * 255), Color.red(color), Color.green(color), Color.blue(color));
    }

    private int overlayType() {
        return Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
    }

    private int dp(int value) {
        return Math.round(dpF(value));
    }

    private float dpF(float value) {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value, activity.getResources().getDisplayMetrics());
    }

    private String readAsset(String path) {
        try (InputStream input = activity.getAssets().open(path)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int length;
            while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (Exception error) {
            return null;
        }
    }

    private PanelTheme theme() {
        boolean dark = (activity.getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        return dark ? PanelTheme.dark() : PanelTheme.light();
    }

    /** 面板配色，取自 docs/手机悬浮窗-面板规格.md 的 token。 */
    private static final class PanelTheme {
        final int panelBg;
        final int line;
        final int text;
        final int muted;
        final int row;
        final int alertBg;
        final int alertLine;
        final int rareLine;
        final int hitBg;
        final int chipBg;
        final int chipText;
        final int chipPrimaryBg;
        final int chipPrimaryText;
        final int chipHotBg;
        final int chipHotText;

        private PanelTheme(int panelBg, int line, int text, int muted, int row,
                           int alertBg, int alertLine, int rareLine, int hitBg,
                           int chipBg, int chipText, int chipPrimaryBg,
                           int chipPrimaryText, int chipHotBg, int chipHotText) {
            this.panelBg = panelBg;
            this.line = line;
            this.text = text;
            this.muted = muted;
            this.row = row;
            this.alertBg = alertBg;
            this.alertLine = alertLine;
            this.rareLine = rareLine;
            this.hitBg = hitBg;
            this.chipBg = chipBg;
            this.chipText = chipText;
            this.chipPrimaryBg = chipPrimaryBg;
            this.chipPrimaryText = chipPrimaryText;
            this.chipHotBg = chipHotBg;
            this.chipHotText = chipHotText;
        }

        static PanelTheme dark() {
            return new PanelTheme(
                0xFF111C33, 0xFF1E293B, 0xFFE2E8F0, 0xFF94A3B8, 0xFF16233B,
                0xFF2A1220, 0xFFBE123C, 0xFFB45309, 0x800F172A,
                0x2E94A3B8, 0xFFCBD5E1, 0xFFE2E8F0, 0xFF0F172A,
                0x38F59E0B, 0xFFFBBF24);
        }

        static PanelTheme light() {
            return new PanelTheme(
                0xFFFFFFFF, 0xFFE2E8F0, 0xFF0F172A, 0xFF64748B, 0xFFF8FAFC,
                0xFFFEF2F2, 0xFFFECDD3, 0xFFFCD34D, 0xFFF8FAFC,
                0xFFF1F5F9, 0xFF475569, 0xFF1E293B, 0xFFFFFFFF,
                0xFFFEF3C7, 0xFFB45309);
        }
    }

    /**
     * 列表滚动容器（2026-11-09）：内容不满一屏时不吃触摸，把事件交回外层面板拖动。
     *
     * <p>内置 ScrollView 会一直消费 ACTION_DOWN 并进入「准备滚动」状态，用户按在列表空白处
     * 就拖不动面板；这里只在真正能滚动的时候才拦截 / 消费。</p>
     */
    private static final class PanelScrollView extends ScrollView {

        PanelScrollView(Context context) {
            super(context);
        }

        private boolean scrollable() {
            return canScrollVertically(1) || canScrollVertically(-1);
        }

        @Override
        public boolean onInterceptTouchEvent(MotionEvent event) {
            return scrollable() && super.onInterceptTouchEvent(event);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            return scrollable() && super.onTouchEvent(event);
        }
    }

    /**
     * 圆角标签背景：与 PC 小窗的 chip 一致，垂直方向按字体基线对称扩展。
     */
    private static final class ChipSpan extends ReplacementSpan {

        private final int background;
        private final int foreground;
        private final float radius;
        private final int paddingHorizontal;
        private final int paddingVertical;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        ChipSpan(int background, int foreground, float radius, int paddingHorizontal, int paddingVertical) {
            this.background = background;
            this.foreground = foreground;
            this.radius = radius;
            this.paddingHorizontal = paddingHorizontal;
            this.paddingVertical = paddingVertical;
        }

        @Override
        public int getSize(Paint base, CharSequence text, int start, int end, Paint.FontMetricsInt metrics) {
            if (metrics != null) {
                Paint.FontMetricsInt font = base.getFontMetricsInt();
                metrics.ascent = font.ascent - paddingVertical;
                metrics.descent = font.descent + paddingVertical;
                metrics.top = font.top - paddingVertical;
                metrics.bottom = font.bottom + paddingVertical;
            }
            return (int) Math.ceil(base.measureText(text, start, end)) + paddingHorizontal * 2;
        }

        @Override
        public void draw(Canvas canvas, CharSequence text, int start, int end, float x,
                         int top, int y, int bottom, Paint base) {
            float width = base.measureText(text, start, end);
            Paint.FontMetricsInt font = base.getFontMetricsInt();
            float rectTop = y + font.ascent - paddingVertical;
            float rectBottom = y + font.descent + paddingVertical;
            paint.setColor(background);
            canvas.drawRoundRect(
                new RectF(x, rectTop, x + width + paddingHorizontal * 2, rectBottom),
                radius, radius, paint);
            int previous = base.getColor();
            base.setColor(foreground);
            canvas.drawText(text, start, end, x + paddingHorizontal, y, base);
            base.setColor(previous);
        }
    }
}
