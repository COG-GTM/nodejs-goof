package io.snyk.goof.todo;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.TextStyle;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Formats a date string with a Moment.js style format ({@code YYYY-MM-DD}, {@code Do MMMM YYYY},
 * ...) in the given locale, as the CSV import of the legacy build did with {@code moment}.
 */
public final class MomentFormat {

	static final String INVALID_DATE = "Invalid date";

	private static final int MAX_FORMAT = 200;

	private static final Pattern TOKENS = Pattern.compile(
			"\\[[^\\]]*]|YYYY|YY|Q|MMMM|MMM|MM|M|Do|DDDD|DDD|DD|D|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|A|a|ZZ|Z|X|x|.",
			Pattern.DOTALL);

	private MomentFormat() {
	}

	public static String format(String when, String locale, String format, ZoneId zone) {
		ZonedDateTime date = parse(when.trim(), zone);
		if (date == null || format.length() > MAX_FORMAT) {
			return INVALID_DATE;
		}
		Locale loc = Locale.forLanguageTag(locale.trim());
		StringBuilder out = new StringBuilder();
		Matcher matcher = TOKENS.matcher(format);
		while (matcher.find()) {
			out.append(render(matcher.group(), date, loc));
		}
		return out.toString();
	}

	static ZonedDateTime parse(String value, ZoneId zone) {
		try {
			return OffsetDateTime.parse(value).atZoneSameInstant(zone);
		}
		catch (DateTimeParseException ignored) {
			// try the next ISO 8601 form
		}
		try {
			return LocalDateTime.parse(value.replace(' ', 'T')).atZone(zone);
		}
		catch (DateTimeParseException ignored) {
			// try the next ISO 8601 form
		}
		try {
			return LocalDate.parse(value).atStartOfDay(zone);
		}
		catch (DateTimeParseException ignored) {
			return null;
		}
	}

	private static String render(String token, ZonedDateTime d, Locale loc) {
		return switch (token) {
			case "YYYY" -> pattern("uuuu", d, loc);
			case "YY" -> pattern("uu", d, loc);
			case "Q" -> Integer.toString((d.getMonthValue() - 1) / 3 + 1);
			case "MMMM" -> d.getMonth().getDisplayName(TextStyle.FULL_STANDALONE, loc);
			case "MMM" -> d.getMonth().getDisplayName(TextStyle.SHORT_STANDALONE, loc);
			case "MM" -> pattern("MM", d, loc);
			case "M" -> Integer.toString(d.getMonthValue());
			case "Do" -> d.getDayOfMonth() + ordinal(d.getDayOfMonth());
			case "DDDD" -> String.format("%03d", d.getDayOfYear());
			case "DDD" -> Integer.toString(d.getDayOfYear());
			case "DD" -> pattern("dd", d, loc);
			case "D" -> Integer.toString(d.getDayOfMonth());
			case "dddd" -> d.getDayOfWeek().getDisplayName(TextStyle.FULL, loc);
			case "ddd" -> d.getDayOfWeek().getDisplayName(TextStyle.SHORT, loc);
			case "dd" -> {
				String shortName = d.getDayOfWeek().getDisplayName(TextStyle.SHORT, loc);
				yield shortName.length() > 2 ? shortName.substring(0, 2) : shortName;
			}
			case "d" -> Integer.toString(d.getDayOfWeek().getValue() % 7);
			case "HH", "H", "hh", "h", "mm", "m", "ss", "s", "SSS" -> pattern(token, d, loc);
			case "A" -> d.getHour() < 12 ? "AM" : "PM";
			case "a" -> d.getHour() < 12 ? "am" : "pm";
			case "ZZ" -> pattern("xx", d, loc);
			case "Z" -> pattern("xxx", d, loc);
			case "X" -> Long.toString(d.toEpochSecond());
			case "x" -> Long.toString(d.toInstant().toEpochMilli());
			default -> token.startsWith("[") && token.endsWith("]") && token.length() > 1
					? token.substring(1, token.length() - 1) : token;
		};
	}

	private static String pattern(String pattern, ZonedDateTime d, Locale loc) {
		return DateTimeFormatter.ofPattern(pattern, loc).format(d);
	}

	private static String ordinal(int day) {
		if (day >= 11 && day <= 13) {
			return "th";
		}
		return switch (day % 10) {
			case 1 -> "st";
			case 2 -> "nd";
			case 3 -> "rd";
			default -> "th";
		};
	}
}
