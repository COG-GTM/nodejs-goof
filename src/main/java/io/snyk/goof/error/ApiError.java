package io.snyk.goof.error;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Uniform error body returned by {@link GlobalExceptionHandler}.
 */
@Schema(name = "ApiError")
public record ApiError(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant timestamp,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String error,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String path,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> details) {
}
