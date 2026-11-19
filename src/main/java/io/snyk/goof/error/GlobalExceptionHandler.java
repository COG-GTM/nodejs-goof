package io.snyk.goof.error;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import jakarta.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import io.snyk.goof.todo.InvalidImportFileException;
import io.snyk.goof.todo.TodoNotFoundException;

/**
 * Maps exceptions from all controllers to an {@link ApiError} JSON body.
 */
@ControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	private final Clock clock;

	public GlobalExceptionHandler(Clock clock) {
		this.clock = clock;
	}

	@ExceptionHandler(TodoNotFoundException.class)
	ResponseEntity<ApiError> notFound(TodoNotFoundException ex, HttpServletRequest request) {
		return build(HttpStatus.NOT_FOUND, ex.getMessage(), request, List.of());
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError> invalid(MethodArgumentNotValidException ex, HttpServletRequest request) {
		List<String> details = ex.getBindingResult()
			.getFieldErrors()
			.stream()
			.map(e -> e.getField() + ": " + e.getDefaultMessage())
			.sorted()
			.toList();
		return build(HttpStatus.BAD_REQUEST, "Validation failed", request, details);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	ResponseEntity<ApiError> unreadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
		return build(HttpStatus.BAD_REQUEST, "Malformed request body", request, List.of());
	}

	@ExceptionHandler(InvalidImportFileException.class)
	ResponseEntity<ApiError> invalidImport(InvalidImportFileException ex, HttpServletRequest request) {
		return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request, List.of());
	}

	@ExceptionHandler(MaxUploadSizeExceededException.class)
	ResponseEntity<ApiError> tooLarge(MaxUploadSizeExceededException ex, HttpServletRequest request) {
		return build(HttpStatus.CONTENT_TOO_LARGE, "Uploaded file is too large", request, List.of());
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError> other(Exception ex, HttpServletRequest request) {
		if (ex instanceof ErrorResponse errorResponse) {
			HttpStatusCode status = errorResponse.getStatusCode();
			String detail = errorResponse.getBody().getDetail();
			return build(status, detail != null ? detail : ex.getMessage(), request, List.of());
		}
		log.error("Unhandled error on {} {}", request.getMethod(), request.getRequestURI(), ex);
		return build(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected error", request, List.of());
	}

	private ResponseEntity<ApiError> build(HttpStatusCode status, String message, HttpServletRequest request,
			List<String> details) {
		HttpStatus resolved = HttpStatus.resolve(status.value());
		String reason = resolved != null ? resolved.getReasonPhrase() : String.valueOf(status.value());
		ApiError body = new ApiError(Instant.now(clock), status.value(), reason, message, request.getRequestURI(),
				details);
		return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
	}
}
