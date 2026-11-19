package io.snyk.goof.todo;

public class TodoNotFoundException extends RuntimeException {

	public TodoNotFoundException(String id) {
		super("Todo " + id + " not found");
	}
}
