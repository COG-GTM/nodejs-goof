package io.snyk.goof.security;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

/**
 * After login, redirects to the {@code redirectPage} form field when it is a path on this site,
 * otherwise to {@code /admin}.
 */
@Component
public class RedirectPageSuccessHandler implements AuthenticationSuccessHandler {

	static final String DEFAULT_TARGET = "/admin";

	private static final Logger log = LoggerFactory.getLogger(RedirectPageSuccessHandler.class);

	@Override
	public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
			Authentication authentication) throws IOException {
		log.info("User logged in: {}", authentication.getName());
		String target = request.getParameter("redirectPage");
		response.sendRedirect(isLocalPath(target) ? target : DEFAULT_TARGET);
	}

	static boolean isLocalPath(String target) {
		if (target == null || target.isBlank() || !target.startsWith("/") || target.startsWith("//")
				|| target.contains("\\") || target.chars().anyMatch(Character::isISOControl)) {
			return false;
		}
		try {
			URI uri = new URI(target);
			return uri.getScheme() == null && uri.getRawAuthority() == null;
		}
		catch (URISyntaxException ex) {
			return false;
		}
	}
}
