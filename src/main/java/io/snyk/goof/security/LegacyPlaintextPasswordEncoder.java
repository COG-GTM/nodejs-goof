package io.snyk.goof.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Matches passwords that the legacy Node.js build stored without hashing. Only used for matching;
 * such passwords are upgraded to BCrypt on the next successful login.
 */
final class LegacyPlaintextPasswordEncoder implements PasswordEncoder {

	@Override
	public String encode(CharSequence rawPassword) {
		throw new UnsupportedOperationException("Plaintext passwords are never stored");
	}

	@Override
	public boolean matches(CharSequence rawPassword, String encodedPassword) {
		if (rawPassword == null || encodedPassword == null) {
			return false;
		}
		return MessageDigest.isEqual(rawPassword.toString().getBytes(StandardCharsets.UTF_8),
				encodedPassword.getBytes(StandardCharsets.UTF_8));
	}
}
