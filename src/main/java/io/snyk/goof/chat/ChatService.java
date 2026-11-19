package io.snyk.goof.chat;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Service;

/**
 * In-memory chat (no database, as in the legacy build). {@code user}/{@code pwd} may post; only the
 * {@code admin} user, whose password is random per process, may delete.
 */
@Service
public class ChatService {

	static final String DEFAULT_ICON = "👋";

	private static final Set<String> SERVER_FIELDS = Set.of("id", "timestamp", "userName");

	private final List<ChatUser> users;

	private final List<Map<String, Object>> messages = new CopyOnWriteArrayList<>();

	private final AtomicLong lastId = new AtomicLong(1);

	private final Clock clock;

	public ChatService(Clock clock) {
		this.clock = clock;
		this.users = List.of(new ChatUser("user", "pwd", false), new ChatUser("admin", randomPassword(), true));
	}

	public List<Map<String, Object>> messages() {
		return List.copyOf(messages);
	}

	public boolean add(Credentials auth, Map<String, Object> message) {
		Optional<ChatUser> user = find(auth);
		if (user.isEmpty()) {
			return false;
		}
		Map<String, Object> stored = new LinkedHashMap<>();
		stored.put("icon", DEFAULT_ICON);
		if (message != null) {
			message.forEach((key, value) -> {
				if (!SERVER_FIELDS.contains(key)) {
					stored.put(key, value);
				}
			});
		}
		stored.put("id", lastId.getAndIncrement());
		stored.put("timestamp", clock.millis());
		stored.put("userName", user.get().name());
		messages.add(stored);
		return true;
	}

	public boolean delete(Credentials auth, Long messageId) {
		Optional<ChatUser> user = find(auth);
		if (user.isEmpty() || !user.get().canDelete()) {
			return false;
		}
		messages.removeIf(m -> messageId != null && messageId.equals(m.get("id")));
		return true;
	}

	private Optional<ChatUser> find(Credentials auth) {
		if (auth == null || auth.name() == null || auth.password() == null) {
			return Optional.empty();
		}
		return users.stream()
			.filter(u -> u.name().equals(auth.name()) && u.password().equals(auth.password()))
			.findFirst();
	}

	private static String randomPassword() {
		byte[] bytes = new byte[24];
		new SecureRandom().nextBytes(bytes);
		return java.util.HexFormat.of().formatHex(bytes);
	}

	private record ChatUser(String name, String password, boolean canDelete) {
	}
}
