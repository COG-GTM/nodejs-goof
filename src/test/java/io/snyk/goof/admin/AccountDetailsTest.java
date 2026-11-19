package io.snyk.goof.admin;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AccountDetailsTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void acceptsValidDetails() {
		AccountDetails details = new AccountDetails("Liran ", "Tal", "IL", "+972541234567",
				"Liran <liran@example.com>");
		assertThat(validator.validate(details)).isEmpty();
		assertThat(details.withNamesRightTrimmed().firstname()).isEqualTo("Liran");
	}

	@ParameterizedTest
	@ValueSource(strings = { "12345", "+441234567890", "0501234567x" })
	void rejectsNonIsraeliMobile(String phone) {
		AccountDetails details = new AccountDetails("A", "B", "IL", phone, "a@example.com");
		assertThat(validator.validate(details)).extracting(v -> v.getPropertyPath().toString()).containsExactly("phone");
	}

	@Test
	void rejectsNonAsciiNamesAndBadEmail() {
		AccountDetails details = new AccountDetails("Jöhn", "B", "IL", "0541234567", "not-an-email");
		assertThat(validator.validate(details)).extracting(v -> v.getPropertyPath().toString())
			.containsExactlyInAnyOrder("firstname", "email");
	}

	@Test
	void emailAddressRules() {
		assertThat(EmailAddress.isValid("admin@snyk.io")).isTrue();
		assertThat(EmailAddress.isValid("admin")).isFalse();
		assertThat(EmailAddress.isValid(null)).isFalse();
		assertThat(EmailAddress.isValidWithDisplayName("Admin <admin@snyk.io>")).isTrue();
		assertThat(EmailAddress.isValidWithDisplayName("Admin <admin>")).isFalse();
	}
}
