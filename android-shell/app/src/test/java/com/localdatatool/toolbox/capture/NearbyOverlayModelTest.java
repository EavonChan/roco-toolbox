package com.localdatatool.toolbox.capture;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.Arrays;
import java.util.HashSet;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

/**
 * 悬浮面板的纯逻辑（数值口径见 docs/手机悬浮窗-面板规格.md）。
 */
public class NearbyOverlayModelTest {

    private static JSONObject payload(String panels) throws Exception {
        JSONObject json = new JSONObject();
        json.put("visible", true);
        json.put("capturing", true);
        json.put("hasKey", true);
        json.put("scene", 10003);
        json.put("self", new JSONObject().put("x", 307500).put("y", 410000));
        json.put("total", 5);
        json.put("rareTotal", 2);
        json.put("pets", pets(5));
        if (panels != null) json.put("panels", new JSONObject(panels));
        return json;
    }

    private static JSONArray pets(int count) throws Exception {
        JSONArray pets = new JSONArray();
        for (int index = 0; index < count; index++) {
            pets.put(new JSONObject()
                .put("key", "p" + index)
                .put("name", "精灵" + index)
                .put("level", 30 + index)
                .put("kinds", new JSONArray())
                .put("rare", index < 2)
                .put("alert", index == 0)
                .put("distanceM", 10 + index)
                .put("bearingLabel", "东北")
                .put("bearingArrow", "↗")
                .put("x", 307500 + index * 100)
                .put("y", 410000));
        }
        return pets;
    }

    @Test public void petParsesBearingArrow() throws Exception {
        NearbyOverlayModel model = NearbyOverlayModel.parse(payload(null));
        assertEquals("↗", model.pets.get(0).bearingArrow);
        assertEquals("东北", model.pets.get(0).bearingLabel);

        // 旧网页不传 bearingArrow：保持空串，列表退回方位文字
        JSONObject legacy = payload(null);
        JSONArray legacyPets = new JSONArray();
        legacyPets.put(new JSONObject().put("key", "a").put("name", "旧数据").put("bearingLabel", "东"));
        legacy.put("pets", legacyPets);
        NearbyOverlayModel legacyModel = NearbyOverlayModel.parse(legacy);
        assertEquals("", legacyModel.pets.get(0).bearingArrow);
    }

    @Test public void missingPanelsFallsBackToBothOn() throws Exception {
        NearbyOverlayModel model = NearbyOverlayModel.parse(payload(null));
        assertNotNull(model);
        assertTrue(model.battle);
        assertTrue(model.nearby);
    }

    @Test public void nonBooleanPanelFallsBackToOn() throws Exception {
        NearbyOverlayModel model = NearbyOverlayModel.parse(
            payload("{\"battle\":\"no\",\"nearby\":0}"));
        assertTrue(model.battle);
        assertTrue(model.nearby);
    }

    @Test public void bothPanelsOffFallsBackToBothOn() throws Exception {
        NearbyOverlayModel model = NearbyOverlayModel.parse(
            payload("{\"battle\":false,\"nearby\":false}"));
        assertTrue(model.battle);
        assertTrue(model.nearby);
    }

    @Test public void singlePanelConfigurationIsKept() throws Exception {
        NearbyOverlayModel battleOnly = NearbyOverlayModel.parse(
            payload("{\"battle\":true,\"nearby\":false}"));
        assertTrue(battleOnly.battle);
        assertFalse(battleOnly.nearby);

        NearbyOverlayModel nearbyOnly = NearbyOverlayModel.parse(
            payload("{\"battle\":false,\"nearby\":true}"));
        assertFalse(nearbyOnly.battle);
        assertTrue(nearbyOnly.nearby);
    }

    @Test public void listKeepsMaxRowsAndReportsHiddenTotal() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        json.put("pets", pets(NearbyOverlayModel.MAX_ROWS + 6));
        json.put("total", NearbyOverlayModel.MAX_ROWS + 12);
        json.put("matched", NearbyOverlayModel.MAX_ROWS + 6);
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals(NearbyOverlayModel.MAX_ROWS, model.pets.size());
        assertEquals(NearbyOverlayModel.MAX_ROWS, model.shownRows());
        assertEquals(6, model.hiddenCount());
        assertEquals("还有 6 只未显示", model.footText());
        assertEquals("附近 " + (NearbyOverlayModel.MAX_ROWS + 12) + " · 稀有 2", model.titleText());
    }

    @Test public void missingPetFieldsDoNotBreakParsing() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        JSONArray pets = new JSONArray();
        pets.put(new JSONObject().put("key", "only-key"));
        pets.put(new JSONObject().put("key", "null-coords")
            .put("name", "雪豆丁")
            .put("rare", true)
            .put("alert", true)
            .put("x", JSONObject.NULL)
            .put("y", JSONObject.NULL)
            .put("distanceM", JSONObject.NULL)
            .put("bearingLabel", JSONObject.NULL));
        json.put("pets", pets);
        json.put("total", 2);
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals(2, model.pets.size());
        assertEquals("", model.pets.get(0).name);
        assertNull(model.pets.get(1).x);
        assertNull(model.pets.get(1).distanceM);
    }

    @Test public void plainPetsOnlyCountInNearbyTotal() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        json.put("pets", pets(1));
        json.put("total", 21);
        json.put("matched", 1);
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals(21, model.total);
        assertEquals(1, model.matchedTotal);
        assertEquals(1, model.shownRows());
        assertEquals(0, model.hiddenCount());
        assertFalse(model.noTargets());
        assertEquals("附近 21 · 稀有 2", model.titleText());
    }

    @Test public void noMatchedTargetsShowsTargetEmptyState() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        json.put("pets", new JSONArray());
        json.put("total", 6);
        json.put("matched", 0);
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals(0, model.shownRows());
        assertEquals(0, model.hiddenCount());
        assertTrue(model.noTargets());
    }

    @Test public void nullPayloadIsIgnored() {
        assertNull(NearbyOverlayModel.parse(null));
    }

    @Test public void panelHeightMatchesSpecTable() {
        // 有地图：列表区固定等于地图高度（120），行数再多也不再拉长面板
        assertEquals(64 + 28 + 120 + 8, NearbyOverlayModel.panelHeight(true, true, true, 5, true, 0));
        assertEquals(64 + 28 + 120 + 20, NearbyOverlayModel.panelHeight(true, true, true, 8, true, 4));
        assertEquals(64 + 28 + 120 + 20, NearbyOverlayModel.panelHeight(true, true, true, 24, true, 4));
        // 仅命中
        assertEquals(64, NearbyOverlayModel.panelHeight(true, true, false, 0, false, 0));
        // 命中区无数据 + 附近无精灵（实测 200）
        assertEquals(200, NearbyOverlayModel.panelHeight(true, false, true, 0, true, 0));
        // 仅附近，5 条
        assertEquals(28 + 120 + 8, NearbyOverlayModel.panelHeight(false, false, true, 5, true, 0));
        // 仅附近，8 条截断
        assertEquals(28 + 120 + 20, NearbyOverlayModel.panelHeight(false, false, true, 8, true, 4));
        // 只有列表（无地图）：短列表按行数算，超过地图高度就封顶
        assertEquals(64 + 28 + NearbyOverlayModel.ROW_HEIGHT * 2 + NearbyOverlayModel.ROW_GAP + 8,
            NearbyOverlayModel.panelHeight(true, true, true, 2, false, 0));
        assertEquals(64 + 28 + 120 + 8, NearbyOverlayModel.panelHeight(true, true, true, 20, false, 0));
        // 空列表 + 无地图
        assertEquals(64 + 28 + 44 + 8, NearbyOverlayModel.panelHeight(true, true, true, 0, false, 0));
    }

    @Test public void emptyAndWaitingStatesUseSpecWording() throws Exception {
        JSONObject empty = payload("{\"battle\":true,\"nearby\":true}");
        empty.put("pets", new JSONArray());
        empty.put("total", 0);
        NearbyOverlayModel emptyModel = NearbyOverlayModel.parse(empty);
        assertFalse(emptyModel.waitingLogin());
        assertEquals("0", emptyModel.orbCountText());

        JSONObject waiting = payload("{\"battle\":true,\"nearby\":true}");
        waiting.put("pets", new JSONArray());
        waiting.put("total", 0);
        waiting.put("hasKey", false);
        NearbyOverlayModel waitingModel = NearbyOverlayModel.parse(waiting);
        assertTrue(waitingModel.waitingLogin());
        assertEquals("—", waitingModel.orbCountText());
    }

    @Test public void estimatedCenterAndStaticTexts() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        json.put("selfEstimated", true);
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertTrue(model.selfEstimated);
        assertEquals("中心为估算", NearbyOverlayModel.ESTIMATED_BADGE);
        assertEquals("附近暂时没有精灵", NearbyOverlayModel.EMPTY_NEARBY_TITLE);
        assertEquals("进入野外后自动出现", NearbyOverlayModel.EMPTY_NEARBY_HINT);
        assertEquals("登录后显示附近精灵", NearbyOverlayModel.WAITING_LOGIN);
        assertEquals("进入赛季奇遇战后，这里会显示守卫的个体数据。", NearbyOverlayModel.HIT_EMPTY_TEXT);
    }

    @Test public void mapCatalogComesFromSharedCalibrationJson() {
        String json = "{\"maps\":{\"10003\":{\"name\":\"卡洛西亚大陆\"},\"10007\":{}}}";
        assertEquals(new HashSet<>(Arrays.asList(10003, 10007)),
            NearbyOverlayModel.parseMapScenes(json));
        assertEquals(new HashSet<Integer>(), NearbyOverlayModel.parseMapScenes("not json"));
    }

    @Test public void mapPetsFallBackToListWhenPayloadIsOld() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals(model.pets.size(), model.mapPets.size());
        assertEquals("p0", model.mapPets.get(0).key);
    }

    @Test public void mapPetsKeepPlainPetsForRadar() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        json.put("pets", pets(1));
        json.put("mapPets", pets(6));
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals(1, model.pets.size());
        assertEquals(6, model.mapPets.size());
        assertEquals("p5", model.mapPets.get(5).key);
    }

    @Test public void mapPetsAreCapped() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        json.put("mapPets", pets(40));
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals(NearbyOverlayModel.MAX_MAP_POINTS, model.mapPets.size());
    }

    @Test public void petReasonIsParsedAndDefaultsToEmpty() throws Exception {
        JSONObject json = payload("{\"battle\":true,\"nearby\":true}");
        JSONArray pets = new JSONArray();
        pets.put(new JSONObject().put("key", "demand").put("reason", "demand"));
        pets.put(new JSONObject().put("key", "legacy"));
        json.put("pets", pets);
        NearbyOverlayModel model = NearbyOverlayModel.parse(json);
        assertEquals("demand", model.pets.get(0).reason);
        assertEquals("", model.pets.get(1).reason);
    }
}

