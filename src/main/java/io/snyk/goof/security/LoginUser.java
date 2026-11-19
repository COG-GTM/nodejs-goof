package io.snyk.goof.security;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Admin account stored in the Mongo {@code users} collection.
 */
@Document(collection = "users")
public class LoginUser {

	@Id
	private String id;

	private String username;

	private String password;

	protected LoginUser() {
	}

	public LoginUser(String username, String password) {
		this.username = username;
		this.password = password;
	}

	public String getId() {
		return id;
	}

	public String getUsername() {
		return username;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}
}
