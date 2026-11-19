package io.snyk.goof.todo;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.Hidden;

/**
 * Server-rendered todo list pages (legacy routes kept for the browser UI).
 */
@Hidden
@Controller
public class TodoController {

	static final String TITLE = "Patch TODO List";

	static final String SUBHEAD = "Vulnerabilities at their best";

	private final TodoService todos;

	private final MarkdownRenderer markdown;

	public TodoController(TodoService todos, MarkdownRenderer markdown) {
		this.todos = todos;
		this.markdown = markdown;
	}

	@GetMapping("/")
	public String index(Model model) {
		List<TodoView> items = todos.findAll()
			.stream()
			.map(t -> new TodoView(t.getId(), t.getContent(), markdown.render(t.getContent())))
			.toList();
		model.addAttribute("title", TITLE);
		model.addAttribute("subhead", SUBHEAD);
		model.addAttribute("todos", items);
		return "index";
	}

	@PostMapping("/create")
	public ResponseEntity<String> create(@RequestParam(name = "content", defaultValue = "") String content) {
		Todo todo = todos.create(content);
		String encoded = Base64.getEncoder().encodeToString(todo.getContent().getBytes(StandardCharsets.UTF_8));
		return ResponseEntity.status(HttpStatus.FOUND)
			.header(HttpHeaders.LOCATION, "/")
			.contentType(MediaType.TEXT_PLAIN)
			.body(encoded);
	}

	@GetMapping("/destroy/{id}")
	public String destroy(@PathVariable String id) {
		todos.delete(id);
		return "redirect:/";
	}

	@GetMapping("/edit/{id}")
	public String edit(@PathVariable String id, Model model) {
		model.addAttribute("title", "TODO");
		model.addAttribute("todos", todos.findAll()
			.stream()
			.map(t -> new TodoView(t.getId(), t.getContent(), null))
			.toList());
		model.addAttribute("current", id);
		return "edit";
	}

	@PostMapping("/update/{id}")
	public String update(@PathVariable String id, @RequestParam(name = "content", defaultValue = "") String content) {
		todos.update(id, content);
		return "redirect:/";
	}

	@PostMapping("/import")
	public ResponseEntity<String> importTodos(@RequestParam(name = "importFile", required = false) MultipartFile file)
			throws java.io.IOException {
		if (file == null) {
			return ResponseEntity.ok()
				.contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
				.body("No files were uploaded.");
		}
		todos.importTodos(file.getBytes());
		return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, "/").build();
	}

	/**
	 * Todo as shown in the list; {@code html} is the rendered Markdown (HTML already escaped).
	 */
	public record TodoView(String id, String content, String html) {
	}
}
