package io.snyk.goof.admin;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Email checks equivalent to {@code validator.isEmail}, optionally accepting a display name
 * ({@code Display Name <user@example.com>}).
 */
public final class EmailAddress {

	private static final Pattern ADDRESS = Pattern.compile("[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@"
			+ "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*"
			+ "\\.[A-Za-z]{2,63}");

	private static final Pattern DISPLAY_NAME = Pattern.compile("([^<>]{0,200}?)\\s*<([^<>]{1,320})>");

	private EmailAddress() {
	}

	public static boolean isValid(String value) {
		return value != null && value.length() <= 320 && ADDRESS.matcher(value).matches();
	}

	public static boolean isValidWithDisplayName(String value) {
		if (value == null) {
			return false;
		}
		Matcher matcher = DISPLAY_NAME.matcher(value);
		return matcher.matches() ? isValid(matcher.group(2)) : isValid(value);
	}
}
