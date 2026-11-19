package io.snyk.goof.todo;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * Todo item stored in the {@code todos} collection. The content is kept as binary data so documents
 * written by the legacy Node.js (Mongoose {@code Buffer}) build stay readable.
 */
@Document(collection = "todos")
public class Todo {

	@Id
	private String id;

	private byte[] content;

	@Field("updated_at")
	private Instant updatedAt;

	protected Todo() {
	}

	public Todo(String content, Instant updatedAt) {
		setContent(content);
		this.updatedAt = updatedAt;
	}

	public String getId() {
		return id;
	}

	public String getContent() {
		return content == null ? "" : new String(content, StandardCharsets.UTF_8);
	}

	public void setContent(String content) {
		this.content = content == null ? new byte[0] : content.getBytes(StandardCharsets.UTF_8);
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}
}
