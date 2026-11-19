package io.snyk.goof.admin;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/**
 * Email address, optionally with a display name ({@code Jane Doe <jane@example.com>}).
 */
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT })
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidEmail.Validator.class)
public @interface ValidEmail {

	String message() default "must be a valid email address";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	class Validator implements ConstraintValidator<ValidEmail, String> {

		@Override
		public boolean isValid(String value, ConstraintValidatorContext context) {
			return EmailAddress.isValidWithDisplayName(value);
		}
	}
}
