package com.brightbuy.backend.config;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CsrfCookieTests {
    @Test
    void crossSiteProductionTokenAndDeletionUseSecureSameSiteNone() {
        var repository = new SecurityConfiguration().csrfTokenRepository(true, "none");
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        repository.saveToken(repository.generateToken(request), request, response);
        assertThat(response.getCookie("XSRF-TOKEN").getSecure()).isTrue();
        assertThat(response.getCookie("XSRF-TOKEN").getAttribute("SameSite")).isEqualToIgnoringCase("none");
        var deletion = new MockHttpServletResponse();
        repository.saveToken(null, request, deletion);
        assertThat(deletion.getCookie("XSRF-TOKEN").getSecure()).isTrue();
        assertThat(deletion.getCookie("XSRF-TOKEN").getAttribute("SameSite")).isEqualToIgnoringCase("none");
        assertThat(deletion.getCookie("XSRF-TOKEN").getMaxAge()).isZero();
    }

    @Test
    void localhostDevelopmentCookieDoesNotRequireHttps() {
        var repository = new SecurityConfiguration().csrfTokenRepository(false, "lax");
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        repository.saveToken(repository.generateToken(request), request, response);
        assertThat(response.getCookie("XSRF-TOKEN").getSecure()).isFalse();
        assertThat(response.getCookie("XSRF-TOKEN").getAttribute("SameSite")).isEqualToIgnoringCase("lax");
    }
}
