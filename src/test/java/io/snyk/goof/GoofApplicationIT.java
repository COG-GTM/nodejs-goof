package io.snyk.goof;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.mysql.MySQLContainer;

import io.snyk.goof.security.LoginUser;
import io.snyk.goof.security.LoginUserRepository;
import io.snyk.goof.todo.TodoRepository;

/**
 * End-to-end tests against real MongoDB and MySQL containers.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class GoofApplicationIT {

	@Container
	@ServiceConnection
	static final MongoDBContainer MONGO = new MongoDBContainer("mongo:7");

	@Container
	@ServiceConnection
	static final MySQLContainer MYSQL = new MySQLContainer("mysql:8.4");

	@Autowired
	MockMvc mvc;

	@Autowired
	TodoRepository todos;

	@Autowired
	LoginUserRepository loginUsers;

	@BeforeEach
	void clean() {
		todos.deleteAll();
	}

	@Test
	void legacyTodoFlow() throws Exception {
		mvc.perform(post("/create").with(csrf()).param("content", "Walk the dog in 2 hours"))
			.andExpect(status().isFound())
			.andExpect(redirectedUrl("/"))
			.andExpect(content().string(
					Base64.getEncoder().encodeToString("Walk the dog [2h]".getBytes(StandardCharsets.UTF_8))));
		String id = todos.findAll().get(0).getId();

		mvc.perform(get("/"))
			.andExpect(status().isOk())
			.andExpect(content().string(containsString("Walk the dog [2h]")));
		mvc.perform(get("/edit/" + id))
			.andExpect(content().string(containsString("action=\"/update/" + id + "\"")));
		mvc.perform(post("/update/" + id).with(csrf()).param("content", "**Feed** <b>cat</b>"))
			.andExpect(redirectedUrl("/"));
		mvc.perform(get("/"))
			.andExpect(content().string(containsString("<strong>Feed</strong> &lt;b&gt;cat&lt;/b&gt;")));
		mvc.perform(get("/destroy/" + id)).andExpect(redirectedUrl("/"));
		assertThat(todos.count()).isZero();
	}

	@Test
	void htmlFormsRequireCsrfToken() throws Exception {
		mvc.perform(post("/create").param("content", "x")).andExpect(status().isForbidden());
	}

	@Test
	void csvImport() throws Exception {
		MockMultipartFile file = new MockMultipartFile("importFile", "todos.csv", "text/csv",
				"Bake a cake\nTravel to Thailand,2017-01-01,be,YYYY-MM-DD\n".getBytes(StandardCharsets.UTF_8));
		mvc.perform(multipart("/import").file(file).with(csrf())).andExpect(redirectedUrl("/"));
		mvc.perform(get("/"))
			.andExpect(content().string(containsString("Bake a cake")))
			.andExpect(content().string(containsString("Travel to Thailand [2017-01-01]")));
		mvc.perform(multipart("/import").with(csrf())).andExpect(content().string("No files were uploaded."));
	}

	@Test
	void todoApiCrudAndErrors() throws Exception {
		MvcResult created = mvc
			.perform(post("/api/v1/todos").contentType(MediaType.APPLICATION_JSON)
				.content("{\"content\":\"Pay rent in 3 days\"}"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.content").value("Pay rent [3d]"))
			.andReturn();
		String location = created.getResponse().getHeader("Location");

		mvc.perform(get(location)).andExpect(jsonPath("$.content").value("Pay rent [3d]"));
		mvc.perform(put(location).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Paid\"}"))
			.andExpect(jsonPath("$.content").value("Paid"));
		mvc.perform(get("/api/v1/todos")).andExpect(jsonPath("$", hasSize(1)));
		mvc.perform(delete(location)).andExpect(status().isNoContent());

		mvc.perform(get(location))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.path").value(location));
		mvc.perform(post("/api/v1/todos").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.details[0]").value(containsString("content")));
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1/todos"))
			.andExpect(status().isMethodNotAllowed())
			.andExpect(header().string("Allow", containsString("GET")))
			.andExpect(jsonPath("$.status").value(405));
		mvc.perform(post("/api/v1/todos").contentType(MediaType.APPLICATION_JSON).content("{not json"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.message").value("Malformed request body"));
	}

	@Test
	void adminLoginFlow() throws Exception {
		mvc.perform(get("/admin")).andExpect(redirectedUrl("/"));
		mvc.perform(get("/login")).andExpect(content().string(containsString("name=\"password\"")));
		mvc.perform(post("/login").with(csrf()).param("username", "admin@snyk.io").param("password", "wrong"))
			.andExpect(status().isUnauthorized());
		mvc.perform(post("/login").with(csrf()).param("username", "notanemail").param("password", "x"))
			.andExpect(status().isUnauthorized());

		MvcResult login = mvc
			.perform(post("/login").with(csrf())
				.param("username", "admin@snyk.io")
				.param("password", "SuperSecretPassword")
				.param("redirectPage", "/account_details"))
			.andExpect(redirectedUrl("/account_details"))
			.andReturn();
		MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);

		mvc.perform(get("/admin").session(session))
			.andExpect(content().string(containsString("Admin Access Granted")));
		mvc.perform(get("/account_details").session(session))
			.andExpect(content().string(containsString("Account details missing")));
		mvc.perform(post("/account_details").session(session)
			.with(csrf())
			.param("firstname", "Liran ")
			.param("lastname", "Tal")
			.param("country", "IL")
			.param("phone", "0541234567")
			.param("email", "liran@example.com"))
			.andExpect(content().string(containsString("Account details for: Liran")));
		mvc.perform(post("/account_details").session(session)
			.with(csrf())
			.param("firstname", "Liran")
			.param("lastname", "Tal")
			.param("country", "IL")
			.param("phone", "123")
			.param("email", "liran@example.com"))
			.andExpect(content().string(containsString("Account details missing")));
		mvc.perform(get("/logout").session(session)).andExpect(redirectedUrl("/"));
	}

	@Test
	void legacyPlaintextPasswordIsUpgradedOnLogin() throws Exception {
		loginUsers.save(new LoginUser("legacy@snyk.io", "plain"));
		mvc.perform(post("/login").with(csrf()).param("username", "legacy@snyk.io").param("password", "plain"))
			.andExpect(redirectedUrl("/admin"));
		assertThat(loginUsers.findFirstByUsername("legacy@snyk.io").orElseThrow().getPassword())
			.startsWith("{bcrypt}");
	}

	@Test
	void chatApi() throws Exception {
		mvc.perform(put("/chat").contentType(MediaType.APPLICATION_JSON)
			.content("{\"auth\":{\"name\":\"user\",\"password\":\"pwd\"},\"message\":{\"text\":\"hi\"}}"))
			.andExpect(jsonPath("$.ok").value(true));
		mvc.perform(get("/api/v1/chat")).andExpect(jsonPath("$[-1].text").value("hi"));
		mvc.perform(delete("/chat").contentType(MediaType.APPLICATION_JSON)
			.content("{\"auth\":{\"name\":\"user\",\"password\":\"pwd\"},\"messageId\":1}"))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.error").value("Access denied"));
	}

	@Test
	void usersApi() throws Exception {
		mvc.perform(get("/users"))
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].name").value("Liran"))
			.andExpect(jsonPath("$[0].role").value("user"));
		mvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
			.content("{\"name\":\"Ada\",\"address\":\"UK\",\"role\":\"user\"}")).andExpect(content().string("OK"));
		mvc.perform(post("/users").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void aboutPageAndStaticAssets() throws Exception {
		mvc.perform(get("/about_new").param("device", "Desktop"))
			.andExpect(content().string(containsString("font-size: medium")))
			.andExpect(content().string(containsString("Device string (debug): Desktop")));
		mvc.perform(get("/about_new").param("device", "<script>"))
			.andExpect(content().string(not(containsString("<script>"))));
		mvc.perform(get("/public/css/screen.css")).andExpect(status().isOk());
		mvc.perform(get("/actuator/health")).andExpect(jsonPath("$.status").value("UP"));
		mvc.perform(get("/swagger-ui.html")).andExpect(status().is3xxRedirection());
		mvc.perform(get("/v3/api-docs")).andExpect(header().string("Content-Type", containsString("json")));
	}
}
