package io.snyk.goof.users;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
 * Users API backed by MySQL. {@code /users} is the legacy path, {@code /api/v1/users} the versioned one.
 */
@RestController
@RequestMapping({ "/api/v1/users", "/users" })
@Tag(name = "Users", description = "Account records stored in MySQL")
public class UsersController {

	static final int CURRENT_ACCOUNT_ID = 1;

	private final UserRecordRepository users;

	public UsersController(UserRecordRepository users) {
		this.users = users;
	}

	@Operation(operationId = "getCurrentAccount",
			summary = "Get the current account (fixed to id 1, as in the legacy build)")
	@ApiResponse(responseCode = "200", description = "OK")
	@GetMapping
	public List<UserResponse> current() {
		return users.findAllById(List.of(CURRENT_ACCOUNT_ID)).stream().map(UserResponse::from).toList();
	}

	@Operation(operationId = "createUser", summary = "Create a user record")
	@ApiResponse(responseCode = "200", description = "Saved",
			content = @Content(mediaType = MediaType.TEXT_PLAIN_VALUE, schema = @Schema(type = "string", example = "OK")))
	@ApiResponse(responseCode = "400", description = "Invalid request",
			content = @Content(schema = @Schema(implementation = ApiError.class)))
	@PostMapping
	public ResponseEntity<String> create(@Valid @RequestBody UserRequest request) {
		users.save(new UserRecord(request.name(), request.address(), request.role()));
		return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body("OK");
	}

	@Schema(name = "UserRequest")
	public record UserRequest(@NotBlank @Size(min = 1, max = 255) String name, @NotBlank @Size(min = 1, max = 255) String address,
			@NotBlank @Size(min = 1, max = 255) String role) {
	}

	@Schema(name = "User")
	public record UserResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Integer id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String address,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String role) {

		static UserResponse from(UserRecord user) {
			return new UserResponse(user.getId(), user.getName(), user.getAddress(), user.getRole());
		}
	}
}
