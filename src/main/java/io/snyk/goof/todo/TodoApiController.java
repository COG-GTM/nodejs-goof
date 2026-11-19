package io.snyk.goof.todo;

import java.net.URI;
import java.time.Instant;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.snyk.goof.error.ApiError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * JSON API for todos.
 */
@RestController
@RequestMapping("/api/v1/todos")
@Tag(name = "Todos", description = "Todo list items")
public class TodoApiController {

	private final TodoService todos;

	public TodoApiController(TodoService todos) {
		this.todos = todos;
	}

	@Operation(operationId = "listTodos", summary = "List todos, newest first")
	@ApiResponse(responseCode = "200", description = "OK")
	@GetMapping
	public List<TodoResponse> list() {
		return todos.findAll().stream().map(TodoResponse::from).toList();
	}

	@Operation(operationId = "createTodo",
			summary = "Create a todo; a trailing \"in <duration>\" becomes a reminder such as \"[2h]\"")
	@ApiResponse(responseCode = "201", description = "Created")
	@ApiResponse(responseCode = "400", description = "Invalid request",
			content = @Content(schema = @Schema(implementation = ApiError.class)))
	@PostMapping
	public ResponseEntity<TodoResponse> create(@Valid @RequestBody TodoRequest request) {
		Todo todo = todos.create(request.content());
		return ResponseEntity.created(URI.create("/api/v1/todos/" + todo.getId())).body(TodoResponse.from(todo));
	}

	@Operation(operationId = "getTodo", summary = "Get a todo")
	@ApiResponse(responseCode = "200", description = "OK")
	@ApiResponse(responseCode = "404", description = "Not found",
			content = @Content(schema = @Schema(implementation = ApiError.class)))
	@GetMapping("/{id}")
	public TodoResponse get(@PathVariable String id) {
		return TodoResponse.from(todos.get(id));
	}

	@Operation(operationId = "updateTodo", summary = "Replace the content of a todo")
	@ApiResponse(responseCode = "200", description = "OK")
	@ApiResponse(responseCode = "400", description = "Invalid request",
			content = @Content(schema = @Schema(implementation = ApiError.class)))
	@ApiResponse(responseCode = "404", description = "Not found",
			content = @Content(schema = @Schema(implementation = ApiError.class)))
	@PutMapping("/{id}")
	public TodoResponse update(@PathVariable String id, @Valid @RequestBody TodoRequest request) {
		return TodoResponse.from(todos.update(id, request.content()));
	}

	@Operation(operationId = "deleteTodo", summary = "Delete a todo")
	@ApiResponse(responseCode = "204", description = "Deleted")
	@ApiResponse(responseCode = "404", description = "Not found",
			content = @Content(schema = @Schema(implementation = ApiError.class)))
	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable String id) {
		todos.delete(id);
		return ResponseEntity.noContent().build();
	}

	@Schema(name = "TodoRequest")
	public record TodoRequest(@NotNull @Size(max = 10_000) String content) {
	}

	@Schema(name = "Todo")
	public record TodoResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String content,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {

		static TodoResponse from(Todo todo) {
			return new TodoResponse(todo.getId(), todo.getContent(), todo.getUpdatedAt());
		}
	}
}
