package com.localdatatool.toolbox;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/**
 * 服务器地址的纯逻辑：只收 https、抹掉多余斜杠、健康检查必须真的看到 ok:true。
 *
 * <p>探活口径之所以不只看 HTTP 200：主站对不存在的路径会回退成网页（200 + HTML），
 * 之前更新清单就被这种「200」坑过一次。</p>
 */
public class ServerConfigTest {

    @Test public void defaultIsTestSiteAndProductionIsKept() {
        // 1.3 内测包：装上就是测试服，正式服地址保留给连点互切
        assertEquals("https://test.roco-toolbox.pages.dev", ServerConfig.DEFAULT_BASE_URL);
        assertEquals("https://roco-toolbox.pages.dev", ServerConfig.PRODUCTION_BASE_URL);
    }

    @Test public void trimsAndStripsTrailingSlashes() {
        assertEquals("https://internal.roco-toolbox.pages.dev",
            ServerConfig.normalize(" https://internal.roco-toolbox.pages.dev/ "));
        assertEquals("https://internal.roco-toolbox.pages.dev",
            ServerConfig.normalize("https://internal.roco-toolbox.pages.dev///"));
    }

    @Test public void keepsExplicitPort() {
        assertEquals("https://uat.example.com:8443",
            ServerConfig.normalize("https://uat.example.com:8443/"));
    }

    @Test public void rejectsHttp() {
        try {
            ServerConfig.normalize("http://internal.roco-toolbox.pages.dev");
            fail("http 地址必须被拒绝");
        } catch (IllegalArgumentException error) {
            assertTrue(error.getMessage(), error.getMessage().contains("https"));
        }
    }

    @Test public void rejectsBlank() {
        try {
            ServerConfig.normalize("   ");
            fail("空地址必须被拒绝");
        } catch (IllegalArgumentException error) {
            assertTrue(error.getMessage(), error.getMessage().contains("不能为空"));
        }
    }

    @Test public void rejectsAddressWithoutHost() {
        try {
            ServerConfig.normalize("https://");
            fail("没有主机名必须被拒绝");
        } catch (IllegalArgumentException error) {
            assertTrue(error.getMessage(), error.getMessage().contains("地址"));
        }
    }

    @Test public void healthyRequiresOkTrue() {
        assertTrue(ServerConfig.healthy("{\"ok\":true,\"at\":1762500000000}"));
        assertFalse(ServerConfig.healthy("{\"ok\":false}"));
        assertFalse(ServerConfig.healthy("<!doctype html><html><body>index</body></html>"));
        assertFalse(ServerConfig.healthy(""));
    }

    @Test public void originDropsPathAndDefaultPort() {
        assertEquals("https://roco-toolbox.pages.dev",
            ServerConfig.originOf("https://roco-toolbox.pages.dev/some/path"));
        assertEquals("https://roco-toolbox.pages.dev",
            ServerConfig.originOf("https://roco-toolbox.pages.dev:443"));
        assertEquals("https://uat.example.com:8443",
            ServerConfig.originOf("https://uat.example.com:8443/base"));
    }

    @Test public void hostIsReadFromOrigin() {
        assertEquals("internal.roco-toolbox.pages.dev",
            ServerConfig.hostOf("https://internal.roco-toolbox.pages.dev/"));
    }
}
