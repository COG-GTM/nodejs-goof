package io.snyk.goof.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;

/**
 * Metadata for the generated OpenAPI document; the reviewed contract lives in {@code api-spec/openapi.yaml}.
 */
@Configuration
public class OpenApiConfig {

	@Bean
	OpenAPI goofOpenApi() {
		return new OpenAPI().info(new Info().title("Goof Todo API")
			.version("1.0.0")
			.description("JSON API of the Goof todo demo application")
			.license(new License().name("Apache-2.0").identifier("Apache-2.0")));
	}
}
