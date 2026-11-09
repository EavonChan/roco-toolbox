package com.localdatatool.toolbox.capture;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 手机悬浮面板的纯数据与几何计算（2026-11-08）。
 *
 * <p>数值口径见 {@code docs/手机悬浮窗-面板规格.md}，本类不持有 Android 依赖，便于单测。</p>
 */
public final class NearbyOverlayModel {

    /** 列表最多渲染 24 条（高度封顶在小地图高度，超出的在框内上下滑动）。 */
    public static final int MAX_ROWS = 24;
    /** 地图 / 雷达最多画 24 个点（网页已按距离截断，这里再兜一层）。 */
    public static final int MAX_MAP_POINTS = 24;
    /** 面板宽度（与屏宽无关，规格 1.1）。 */
    public static final int PANEL_WIDTH = 268;
    /** 球与屏边 / 面板与球 / 面板与屏边的间距。 */
    public static final int EDGE = 8;
    /** 命中区有数据时的高度。 */
    public static final int HIT_HEIGHT = 64;
    /** 命中区无数据时的高度（实测 200 = 44 + 28 + 120 + 8）。 */
    public static final int HIT_EMPTY_HEIGHT = 44;
    /** 标题行相对命中区底部的偏移。 */
    public static final int TITLE_TOP_GAP = 4;
    /** 地图 / 列表相对命中区底部的偏移。 */
    public static final int BODY_TOP_GAP = 28;
    /** 小地图边长。 */
    public static final int MAP_SIZE = 120;
    /** 列表行高（两行字：名称 / 等级 + 距离 / 方向 / 体型 / 声音，28dp 会把第二行裁掉）。 */
    public static final int ROW_HEIGHT = 34;
    public static final int ROW_GAP = 2;
    /** 列表没有内容时的占位高度。 */
    public static final int EMPTY_BODY_HEIGHT = 44;
    /** 底部「还有 N 只」文案行的高度。 */
    public static final int FOOT_TEXT_HEIGHT = 14;
    /** 没有「还有 N 只」时留白。 */
    public static final int FOOT_GAP = 8;
    /** 有「还有 N 只」时留白。 */
    public static final int FOOT_ROW_GAP = 20;

    public static final String ESTIMATED_BADGE = "中心为估算";
    public static final String EMPTY_NEARBY_TITLE = "附近暂时没有精灵";
    public static final String EMPTY_NEARBY_HINT = "进入野外后自动出现";
    public static final String EMPTY_TARGET_TITLE = "附近暂无命中目标";
    public static final String EMPTY_TARGET_HINT = "普通精灵只在雷达显示";
    public static final String WAITING_LOGIN = "登录后显示附近精灵";
    public static final String HIT_TITLE = "战斗采集 · 赛季奇遇";
    public static final String HIT_EMPTY_TEXT = "进入赛季奇遇战后，这里会显示守卫的个体数据。";

    public final boolean battle;
    public final boolean nearby;
    public final boolean capturing;
    public final boolean hasKey;
    public final Integer scene;
    public final Double selfX;
    public final Double selfY;
    public final boolean selfEstimated;
    public final List<Pet> pets;
    /**
     * 地图 / 雷达点位：附近所有带坐标的精灵（含未命中目标的普通精灵）。
     * 旧网页不带 mapPets 时退回 pets，行为与之前一致。
     */
    public final List<Pet> mapPets;
    public final int total;
    /** 命中目标数（网页只把命中的精灵放进 pets，普通精灵只计入 total）。 */
    public final int matchedTotal;
    public final int rareTotal;
    public final int alertTotal;
    public final long updatedAt;

    private NearbyOverlayModel(JSONObject payload) {
        boolean[] panels = parsePanels(payload);
        battle = panels[0];
        nearby = panels[1];
        capturing = payload.optBoolean("capturing", payload.optBoolean("visible", false));
        hasKey = payload.optBoolean("hasKey", true);
        scene = intOrNull(payload, "scene");

        JSONObject self = payload.optJSONObject("self");
        selfX = self == null ? null : numberOrNull(self, "x");
        selfY = self == null ? null : numberOrNull(self, "y");
        selfEstimated = payload.optBoolean("selfEstimated", false);

        List<Pet> parsed = new ArrayList<>();
        JSONArray array = payload.optJSONArray("pets");
        if (array != null) {
            for (int index = 0; index < array.length(); index++) {
                JSONObject item = array.optJSONObject(index);
                if (item != null) parsed.add(new Pet(item));
            }
        }
        if (parsed.size() > MAX_ROWS) {
            parsed = new ArrayList<>(parsed.subList(0, MAX_ROWS));
        }
        pets = Collections.unmodifiableList(parsed);

        // 地图 / 雷达点位：网页给 mapPets（含普通精灵）就用它，旧 payload 退回 pets
        JSONArray mapArray = payload.optJSONArray("mapPets");
        if (mapArray == null) {
            mapPets = pets;
        } else {
            List<Pet> parsedMap = new ArrayList<>();
            for (int index = 0; index < mapArray.length() && parsedMap.size() < MAX_MAP_POINTS; index++) {
                JSONObject item = mapArray.optJSONObject(index);
                if (item != null) parsedMap.add(new Pet(item));
            }
            mapPets = Collections.unmodifiableList(parsedMap);
        }

        int declaredTotal = payload.has("total") ? payload.optInt("total", pets.size()) : pets.size();
        total = Math.max(declaredTotal, pets.size());
        // 旧网页不带 matched（列表当时是全量）：退回 total，脚注表现与旧版一致
        int declaredMatched = payload.has("matched") ? payload.optInt("matched", total) : total;
        matchedTotal = Math.max(declaredMatched, pets.size());
        rareTotal = payload.has("rareTotal") ? payload.optInt("rareTotal", countRare()) : countRare();
        alertTotal = payload.has("alertTotal") ? payload.optInt("alertTotal", countAlert()) : countAlert();
        updatedAt = payload.optLong("updatedAt", 0L);
    }

    public static NearbyOverlayModel parse(JSONObject payload) {
        return payload == null ? null : new NearbyOverlayModel(payload);
    }

    /**
     * 面板显隐兜底：缺失或非布尔按开；两项都关时回到两者都开。
     */
    public static boolean[] parsePanels(JSONObject payload) {
        boolean battle = true;
        boolean nearby = true;
        JSONObject panels = payload == null ? null : payload.optJSONObject("panels");
        if (panels != null) {
            battle = booleanOrTrue(panels, "battle");
            nearby = booleanOrTrue(panels, "nearby");
        }
        if (!battle && !nearby) {
            battle = true;
            nearby = true;
        }
        return new boolean[] { battle, nearby };
    }

    private static boolean booleanOrTrue(JSONObject object, String key) {
        Object value = object.opt(key);
        return value instanceof Boolean ? (Boolean) value : true;
    }

    private static Integer intOrNull(JSONObject object, String key) {
        if (!object.has(key) || object.isNull(key)) return null;
        int value = object.optInt(key, Integer.MIN_VALUE);
        return value == Integer.MIN_VALUE ? null : value;
    }

    private static Double numberOrNull(JSONObject object, String key) {
        if (!object.has(key) || object.isNull(key)) return null;
        double value = object.optDouble(key, Double.NaN);
        return Double.isNaN(value) ? null : value;
    }

    private int countRare() {
        int count = 0;
        for (Pet pet : pets) if (pet.rare) count++;
        return count;
    }

    private int countAlert() {
        int count = 0;
        for (Pet pet : pets) if (pet.alert) count++;
        return count;
    }

    public boolean waitingLogin() {
        return !hasKey && total == 0;
    }

    public int shownRows() {
        return Math.min(pets.size(), MAX_ROWS);
    }

    public int hiddenCount() {
        return Math.max(0, matchedTotal - shownRows());
    }

    /** 附近有精灵、但一条都没命中：列表改用「暂无命中目标」的文案。 */
    public boolean noTargets() {
        return !waitingLogin() && total > 0 && matchedTotal == 0;
    }

    public String orbCountText() {
        return waitingLogin() ? "—" : String.valueOf(total);
    }

    public String titleText() {
        return "附近 " + total + " · 稀有 " + rareTotal;
    }

    public String footText() {
        return "还有 " + hiddenCount() + " 只未显示";
    }

    /** 列表内容高度：行数 × 行高，空列表用占位高度。 */
    public static int listHeight(int rows) {
        int safe = Math.max(0, Math.min(rows, MAX_ROWS));
        return safe > 0 ? safe * ROW_HEIGHT + (safe - 1) * ROW_GAP : EMPTY_BODY_HEIGHT;
    }

    /** 列表可视区域高度：不超过小地图，超出的在框内滑动。 */
    public static int bodyHeight(int rows, boolean hasMap) {
        if (hasMap) return MAP_SIZE;
        return Math.min(listHeight(rows), MAP_SIZE);
    }

    /**
     * 面板总高度。
     *
     * @param showBattle 是否显示顶部命中区
     * @param hasHit     命中区是否有数据
     * @param showNearby 是否显示附近面板
     * @param rows       实际渲染的列表行数（已截断）
     * @param hasMap     是否有可用的网页地图
     * @param hidden     未显示的条数
     */
    public static int panelHeight(boolean showBattle, boolean hasHit, boolean showNearby,
                                  int rows, boolean hasMap, int hidden) {
        int hitHeight = 0;
        if (showBattle) hitHeight = hasHit ? HIT_HEIGHT : HIT_EMPTY_HEIGHT;
        if (!showNearby) return hitHeight;
        int bodyHeight = bodyHeight(rows, hasMap);
        int footGap = hidden > 0 ? FOOT_ROW_GAP : FOOT_GAP;
        return hitHeight + BODY_TOP_GAP + bodyHeight + footGap;
    }

    /** 读取与网页同一份标定表，只关心有哪些场景有地图。 */
    public static Set<Integer> parseMapScenes(String json) {
        Set<Integer> scenes = new HashSet<>();
        if (json == null || json.isEmpty()) return scenes;
        try {
            JSONObject maps = new JSONObject(json).optJSONObject("maps");
            if (maps == null) return scenes;
            java.util.Iterator<String> keys = maps.keys();
            while (keys.hasNext()) {
                try {
                    scenes.add(Integer.parseInt(keys.next()));
                } catch (NumberFormatException ignored) {
                    // 非场景键直接跳过
                }
            }
        } catch (Exception ignored) {
            return new HashSet<>();
        }
        return scenes;
    }

    public static final class Pet {
        public final String key;
        public final String name;
        public final int level;
        public final List<String> kinds;
        public final boolean rare;
        public final boolean alert;
        /** 命中原因：demand / alert / rare / colorful / shiny / pollution，旧 payload 为空。 */
        public final String reason;
        public final String nature;
        public final String gender;
        public final Double distanceM;
        public final String bearingLabel;
        /** 8 方位箭头（↑↗→↘↓↙←↖）；网页没给时为空串 */
        public final String bearingArrow;
        public final Double x;
        public final Double y;

        Pet(JSONObject item) {
            key = item.optString("key", "");
            name = item.optString("name", "");
            level = item.optInt("level", 0);
            List<String> parsedKinds = new ArrayList<>();
            JSONArray array = item.optJSONArray("kinds");
            if (array != null) {
                for (int index = 0; index < array.length(); index++) {
                    String kind = array.optString(index, "");
                    if (!kind.isEmpty()) parsedKinds.add(kind);
                }
            }
            kinds = Collections.unmodifiableList(parsedKinds);
            rare = item.optBoolean("rare", false);
            alert = item.optBoolean("alert", false);
            reason = item.optString("reason", "");
            nature = item.optString("nature", "");
            gender = item.optString("gender", "");
            distanceM = numberOrNull(item, "distanceM");
            bearingLabel = item.optString("bearingLabel", "");
            bearingArrow = item.optString("bearingArrow", "");
            x = numberOrNull(item, "x");
            y = numberOrNull(item, "y");
        }
    }
}
