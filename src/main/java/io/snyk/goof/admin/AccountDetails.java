package io.snyk.goof.admin;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Account details form. Phone numbers must be Israeli mobile numbers (validator.js {@code he-IL}).
 */
public record AccountDetails(@NotNull @Pattern(regexp = ASCII) String firstname,
		@NotNull @Pattern(regexp = ASCII) String lastname, @NotNull @Pattern(regexp = ASCII) String country,
		@NotNull @Pattern(regexp = HE_IL_MOBILE) String phone, @NotNull @ValidEmail String email) {

	static final String ASCII = "[\\x00-\\x7F]+";

	static final String HE_IL_MOBILE = "(\\+972|0)([23489]|5[012345689]|77)[1-9]\\d{6}";

	public static AccountDetails empty() {
		return new AccountDetails(null, null, null, null, null);
	}

	public AccountDetails withNamesRightTrimmed() {
		return new AccountDetails(firstname.stripTrailing(), lastname.stripTrailing(), country, phone, email);
	}
}
