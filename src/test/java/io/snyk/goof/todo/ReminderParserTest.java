package io.snyk.goof.todo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ReminderParserTest {

	@ParameterizedTest
	@CsvSource(delimiter = '|', value = { "Walk the dog in 2 hours|Walk the dog [2h]",
			"Call mom in 30 minutes|Call mom [30m]", "Pay rent in 3 days|Pay rent [3d]",
			"Ship it in 90 seconds|Ship it [2m]", "Sleep in 1 year|Sleep [365d]", "Blink in 500ms|Blink [500ms]",
			"Read in 1.5h|Read [2h]" })
	void appendsShortReminder(String input, String expected) {
		assertThat(ReminderParser.apply(input)).isEqualTo(expected);
	}

	@Test
	void dropsUnparseableDurationButKeepsText() {
		assertThat(ReminderParser.apply("Walk the dog in the park")).isEqualTo("Walk the dog");
	}

	@Test
	void leavesTodosWithoutReminderUntouched() {
		assertThat(ReminderParser.apply("Buy milk")).isEqualTo("Buy milk");
		assertThat(ReminderParser.apply(" in 2 hours")).isEqualTo(" in 2 hours");
	}

	@Test
	void ignoresOversizedDurations() {
		String todo = "Wait in " + "9".repeat(20_000) + " hours";
		assertThat(ReminderParser.apply(todo)).isEqualTo("Wait");
	}
}
