package com.localdatatool.toolbox.capture;
import org.junit.Test;
import static org.junit.Assert.*;

public class CaptureBridgePolicyTest {
    private static final String PROD = "https://roco-toolbox.pages.dev";

    @Test public void onlyConfiguredOriginMainFrameMayDispatch() {
        assertTrue(CaptureBridgePolicy.allows(PROD, true, PROD));
        assertTrue(CaptureBridgePolicy.allows(PROD + ":443", true, PROD));
        for (String origin : new String[]{PROD, "https://example.com", "null", "about:srcdoc", "data:text/html,x"})
            assertFalse(CaptureBridgePolicy.allows(origin, false, PROD));
        for (String origin : new String[]{"http://roco-toolbox.pages.dev", "https://evil.roco-toolbox.pages.dev", "https://roco-toolbox.pages.dev:444", "https://roco-toolbox.pages.dev.evil.com", "null", null})
            assertFalse(CaptureBridgePolicy.allows(origin, true, PROD));
    }

    /** 切到内测地址后，内测页面要能拿到桥，生产页面不再自动信任。 */
    @Test public void switchedOriginReplacesProduction() {
        String uat = "https://internal.roco-toolbox.pages.dev";
        assertTrue(CaptureBridgePolicy.allows(uat, true, uat));
        assertFalse(CaptureBridgePolicy.allows(PROD, true, uat));
    }
}
