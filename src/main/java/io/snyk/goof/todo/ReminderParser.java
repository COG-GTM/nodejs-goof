package io.snyk.goof.todo;

import java.util.Locale;
import java.util.OptionalDouble;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns "Walk the dog in 2 hours" into "Walk the dog [2h]", matching the {@code humanize-ms} /
 * {@code ms} behaviour of the legacy build. When the reminder cannot be parsed it is dropped.
 */
public final class ReminderParser {

	private static final String REMIND_TOKEN = " in ";

	private static final int MAX_INPUT = 10_000;

	private static final Pattern DURATION = Pattern
		.compile("(\\d+(?:\\.\\d+)?|\\.\\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?", Pattern.CASE_INSENSITIVE);

	private static final double SECOND = 1000;

	private static final double MINUTE = SECOND * 60;

	private static final double HOUR = MINUTE * 60;

	private static final double DAY = HOUR * 24;

	private static final double YEAR = DAY * 365.25;

	private ReminderParser() {
	}

	public static String apply(String todo) {
		int reminder = todo.indexOf(REMIND_TOKEN);
		if (reminder <= 0) {
			return todo;
		}
		String time = todo.substring(reminder + REMIND_TOKEN.length());
		if (time.endsWith("\n")) {
			time = time.substring(0, time.length() - 1);
		}
		OptionalDouble period = parseDuration(time);
		String result = todo.substring(0, reminder);
		if (period.isPresent()) {
			result += " [" + formatDuration(period.getAsDouble()) + "]";
		}
		return result;
	}

	static OptionalDouble parseDuration(String value) {
		if (value.length() > MAX_INPUT) {
			return OptionalDouble.empty();
		}
		Matcher matcher = DURATION.matcher(value);
		if (!matcher.matches()) {
			return OptionalDouble.empty();
		}
		double n = Double.parseDouble(matcher.group(1));
		String unit = matcher.group(2) == null ? "ms" : matcher.group(2).toLowerCase(Locale.ROOT);
		double factor = switch (unit) {
			case "years", "year", "y" -> YEAR;
			case "days", "day", "d" -> DAY;
			case "hours", "hour", "h" -> HOUR;
			case "minutes", "minute", "m" -> MINUTE;
			case "seconds", "second", "s" -> SECOND;
			default -> 1;
		};
		return OptionalDouble.of(n * factor);
	}

	static String formatDuration(double ms) {
		if (ms >= DAY) {
			return Math.round(ms / DAY) + "d";
		}
		if (ms >= HOUR) {
			return Math.round(ms / HOUR) + "h";
		}
		if (ms >= MINUTE) {
			return Math.round(ms / MINUTE) + "m";
		}
		if (ms >= SECOND) {
			return Math.round(ms / SECOND) + "s";
		}
		return (ms == Math.rint(ms) ? Long.toString((long) ms) : Double.toString(ms)) + "ms";
	}
}
