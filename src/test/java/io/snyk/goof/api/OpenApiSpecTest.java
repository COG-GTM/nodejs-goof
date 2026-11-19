package io.snyk.goof.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.SwaggerParseResult;

class OpenApiSpecTest {

	static final String SPEC = "api-spec/openapi.yaml";

	@Test
	void specIsValidOpenApi3() {
		SwaggerParseResult result = new OpenAPIV3Parser().readLocation(SPEC, null, null);
		assertThat(result.getMessages()).isEmpty();
		assertThat(result.getOpenAPI().getOpenapi()).startsWith("3.");
		assertThat(result.getOpenAPI().getPaths()).containsKeys("/api/v1/todos", "/api/v1/todos/{id}", "/api/v1/chat",
				"/api/v1/users");
	}
}
