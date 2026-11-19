package io.snyk.goof.todo;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.ZoneId;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class MomentFormatTest {

	private static final ZoneId UTC = ZoneId.of("UTC");

	@ParameterizedTest
	@CsvSource(delimiter = '|', value = { "2017-01-01|be|YYYY-MM-DD|2017-01-01", "2017-01-01|en|DD/MM/YY|01/01/17",
			"2017-03-05|en|MMMM Do YYYY|March 5th 2017", "2017-03-05|en|ddd, MMM D|Sun, Mar 5",
			"2017-03-05T14:07:09|en|h:mm:ss A|2:07:09 PM", "not a date|en|YYYY|Invalid date" })
	void formatsLikeMoment(String when, String locale, String format, String expected) {
		assertThat(MomentFormat.format(when, locale, format, UTC)).isEqualTo(expected);
	}
}
