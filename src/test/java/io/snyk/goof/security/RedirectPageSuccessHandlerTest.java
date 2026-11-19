package io.snyk.goof.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;

class RedirectPageSuccessHandlerTest {

	private final RedirectPageSuccessHandler handler = new RedirectPageSuccessHandler();

	@Test
	void redirectsToLocalRedirectPage() throws Exception {
		assertThat(redirectFor("/account_details")).isEqualTo("/account_details");
	}

	@Test
	void defaultsToAdmin() throws Exception {
		assertThat(redirectFor(null)).isEqualTo("/admin");
	}

	@ParameterizedTest
	@ValueSource(strings = { "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)",
			"admin" })
	void refusesOpenRedirects(String target) throws Exception {
		assertThat(redirectFor(target)).isEqualTo("/admin");
	}

	private String redirectFor(String target) throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("POST", "/login");
		if (target != null) {
			request.setParameter("redirectPage", target);
		}
		MockHttpServletResponse response = new MockHttpServletResponse();
		handler.onAuthenticationSuccess(request, response, new TestingAuthenticationToken("admin@snyk.io", null));
		return response.getRedirectedUrl();
	}
}
