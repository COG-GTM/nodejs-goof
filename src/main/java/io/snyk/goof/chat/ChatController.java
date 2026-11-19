package io.snyk.goof.chat;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonInclude;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Chat API. {@code /chat} is the legacy path, {@code /api/v1/chat} the versioned one.
 */
@RestController
@RequestMapping({ "/api/v1/chat", "/chat" })
@Tag(name = "Chat", description = "In-memory chat messages")
public class ChatController {

	private static final ChatResult DENIED = new ChatResult(false, "Access denied");

	private final ChatService chat;

	public ChatController(ChatService chat) {
		this.chat = chat;
	}

	@Operation(operationId = "listChatMessages", summary = "List chat messages")
	@ApiResponse(responseCode = "200", description = "OK")
	@GetMapping
	public List<Map<String, Object>> list() {
		return chat.messages();
	}

	@Operation(operationId = "addChatMessage", summary = "Post a chat message")
	@ApiResponse(responseCode = "200", description = "Message added")
	@ApiResponse(responseCode = "403", description = "Access denied",
			content = @Content(schema = @Schema(implementation = ChatResult.class)))
	@PutMapping
	public ResponseEntity<ChatResult> add(@RequestBody ChatAddRequest request) {
		return chat.add(request.auth(), request.message()) ? ResponseEntity.ok(new ChatResult(true, null))
				: ResponseEntity.status(HttpStatus.FORBIDDEN).body(DENIED);
	}

	@Operation(operationId = "deleteChatMessage", summary = "Delete a chat message (admin only)")
	@ApiResponse(responseCode = "200", description = "Message deleted")
	@ApiResponse(responseCode = "403", description = "Access denied",
			content = @Content(schema = @Schema(implementation = ChatResult.class)))
	@DeleteMapping
	public ResponseEntity<ChatResult> delete(@RequestBody ChatDeleteRequest request) {
		return chat.delete(request.auth(), request.messageId()) ? ResponseEntity.ok(new ChatResult(true, null))
				: ResponseEntity.status(HttpStatus.FORBIDDEN).body(DENIED);
	}

	@Schema(name = "ChatAddRequest")
	public record ChatAddRequest(Credentials auth, Map<String, Object> message) {
	}

	@Schema(name = "ChatDeleteRequest")
	public record ChatDeleteRequest(Credentials auth, Long messageId) {
	}

	@Schema(name = "ChatResult")
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public record ChatResult(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean ok, String error) {
	}
}
