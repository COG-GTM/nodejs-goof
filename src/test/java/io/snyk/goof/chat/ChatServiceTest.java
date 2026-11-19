package io.snyk.goof.chat;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;

import org.junit.jupiter.api.Test;

class ChatServiceTest {

	private final ChatService chat = new ChatService(Clock.fixed(Instant.ofEpochMilli(42), ZoneId.of("UTC")));

	private static final Credentials USER = new Credentials("user", "pwd");

	@Test
	void userCanPostWithDefaultIcon() {
		assertThat(chat.add(USER, Map.of("text", "hi"))).isTrue();
		assertThat(chat.messages()).singleElement()
			.isEqualTo(Map.of("icon", "👋", "text", "hi", "id", 1L, "timestamp", 42L, "userName", "user"));
	}

	@Test
	void clientCannotOverrideServerFieldsOrPollutePrototype() {
		chat.add(USER, Map.of("text", "hi", "userName", "admin", "id", 99, "__proto__", Map.of("canDelete", true)));
		Map<String, Object> message = chat.messages().get(0);
		assertThat(message).containsEntry("userName", "user").containsEntry("id", 1L);
		assertThat(chat.delete(USER, 1L)).isFalse();
		assertThat(chat.messages()).hasSize(1);
	}

	@Test
	void unknownUsersAreDenied() {
		assertThat(chat.add(new Credentials("user", "wrong"), Map.of("text", "hi"))).isFalse();
		assertThat(chat.add(null, Map.of())).isFalse();
		assertThat(chat.delete(new Credentials("admin", "admin"), 1L)).isFalse();
	}
}
