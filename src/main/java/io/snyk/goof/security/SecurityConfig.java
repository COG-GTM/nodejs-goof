package io.snyk.goof.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

/**
 * Session-based form login for the admin pages. Everything else stays public as in the legacy app;
 * CSRF protection applies to the HTML forms, while the JSON APIs are exempt.
 */
@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, RedirectPageSuccessHandler successHandler) {
		http.authorizeHttpRequests(auth -> auth.requestMatchers("/admin", "/account_details")
			.authenticated()
			.anyRequest()
			.permitAll())
			.formLogin(form -> form.loginPage("/login")
				.loginProcessingUrl("/login")
				.usernameParameter("username")
				.passwordParameter("password")
				.successHandler(successHandler)
				.failureHandler((request, response, ex) -> response.setStatus(401)))
			.logout(logout -> logout
				.logoutRequestMatcher(PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.GET, "/logout"))
				.logoutSuccessUrl("/"))
			.requestCache(cache -> cache.disable())
			.exceptionHandling(ex -> ex.authenticationEntryPoint(new LoginUrlAuthenticationEntryPoint("/")))
			.csrf(csrf -> csrf.ignoringRequestMatchers("/api/**", "/chat", "/users"));
		return http.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		DelegatingPasswordEncoder encoder = (DelegatingPasswordEncoder) PasswordEncoderFactories
			.createDelegatingPasswordEncoder();
		encoder.setDefaultPasswordEncoderForMatches(new LegacyPlaintextPasswordEncoder());
		return encoder;
	}
}
