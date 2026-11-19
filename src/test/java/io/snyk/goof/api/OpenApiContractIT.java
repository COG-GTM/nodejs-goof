package io.snyk.goof.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.util.Map;
import java.util.TreeMap;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.mysql.MySQLContainer;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.parser.OpenAPIV3Parser;

/**
 * Fails when the code-first API (springdoc) drifts from the committed {@code api-spec/openapi.yaml}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class OpenApiContractIT {

	@Container
	@ServiceConnection
	static final MongoDBContainer MONGO = new MongoDBContainer("mongo:7");

	@Container
	@ServiceConnection
	static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");

	@Autowired
	MockMvc mvc;

	@Test
	void generatedApiMatchesCommittedSpec() throws Exception {
		String generated = mvc.perform(get("/v3/api-docs")).andReturn().getResponse().getContentAsString();
		OpenAPI actual = new OpenAPIV3Parser().readContents(generated).getOpenAPI();
		OpenAPI expected = new OpenAPIV3Parser().read(OpenApiSpecTest.SPEC);

		assertThat(operations(actual)).isEqualTo(operations(expected));
		assertThat(actual.getComponents().getSchemas().keySet())
			.containsExactlyInAnyOrderElementsOf(expected.getComponents().getSchemas().keySet());
		expected.getComponents().getSchemas().forEach((name, schema) -> {
			var generatedSchema = actual.getComponents().getSchemas().get(name);
			assertThat(generatedSchema.getProperties().keySet()).as(name)
				.containsExactlyInAnyOrderElementsOf(schema.getProperties().keySet());
		});
	}

	private static Map<String, String> operations(OpenAPI api) {
		Map<String, String> operations = new TreeMap<>();
		api.getPaths().forEach((path, item) -> item.readOperationsMap().forEach((method, op) -> {
			String responses = new TreeMap<>(op.getResponses()).keySet().toString();
			operations.put(method + " " + path, op.getOperationId() + " " + responses);
		}));
		return operations;
	}

}
