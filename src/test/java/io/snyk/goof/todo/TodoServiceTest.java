package io.snyk.goof.todo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class TodoServiceTest {

	private TodoRepository repository;

	private TodoService service;

	@BeforeEach
	void setUp() {
		repository = mock(TodoRepository.class);
		when(repository.save(any(Todo.class))).thenAnswer(inv -> inv.getArgument(0));
		service = new TodoService(repository, Clock.fixed(Instant.parse("2024-01-01T00:00:00Z"), ZoneId.of("UTC")));
	}

	@Test
	void createParsesReminder() {
		assertThat(service.create("Walk the dog in 2 hours").getContent()).isEqualTo("Walk the dog [2h]");
	}

	@Test
	void createKeepsImageMarkdownVerbatim() {
		String image = "![alt text](https://example.com/a.png \"in 2 hours\")";
		assertThat(service.create(image).getContent()).isEqualTo(image);
	}

	@Test
	void updateReplacesContentAndTimestamp() {
		Todo existing = new Todo("old", Instant.EPOCH);
		when(repository.findById("1")).thenReturn(Optional.of(existing));
		Todo updated = service.update("1", "new");
		assertThat(updated.getContent()).isEqualTo("new");
		assertThat(updated.getUpdatedAt()).isEqualTo(Instant.parse("2024-01-01T00:00:00Z"));
	}

	@Test
	void missingTodoThrows() {
		when(repository.findById("nope")).thenReturn(Optional.empty());
		assertThatThrownBy(() -> service.delete("nope")).isInstanceOf(TodoNotFoundException.class);
	}

	@Test
	void importsCsvLines() {
		String csv = "Bake a cake\nWalk the dog in 2 hours\n\nTravel to Thailand,2017-01-01,be,YYYY-MM-DD\n";
		assertThat(service.importTodos(csv.getBytes(StandardCharsets.UTF_8))).isEqualTo(3);
		assertThat(savedContents(3)).containsExactly("Bake a cake", "Walk the dog in 2 hours",
				"Travel to Thailand [2017-01-01]");
	}

	@Test
	void importsBackupTxtFromZipWithoutExtracting() throws IOException {
		byte[] zip = zip("nested/backup.txt", "Buy milk\n");
		assertThat(service.importTodos(zip)).isEqualTo(1);
		assertThat(savedContents(1)).containsExactly("Buy milk");
	}

	@Test
	void zipWithoutBackupImportsPlaceholderLikeLegacy() throws IOException {
		byte[] zip = zip("../../evil.txt", "pwned");
		assertThat(service.importTodos(zip)).isEqualTo(1);
		assertThat(savedContents(1)).containsExactly(TodoService.NO_BACKUP);
	}

	@Test
	void zipBombInSkippedEntryIsRejected() throws IOException {
		byte[] zip = zip("big.bin", "0".repeat(6 * 1024 * 1024));
		assertThatThrownBy(() -> service.importTodos(zip)).isInstanceOf(InvalidImportFileException.class);
	}

	@Test
	void corruptZipIsRejected() {
		byte[] data = { 'P', 'K', 3, 4, 0, 0, 0 };
		assertThatThrownBy(() -> service.importTodos(data)).isInstanceOf(InvalidImportFileException.class);
	}

	private List<String> savedContents(int count) {
		ArgumentCaptor<Todo> captor = ArgumentCaptor.forClass(Todo.class);
		verify(repository, times(count)).save(captor.capture());
		return captor.getAllValues().stream().map(Todo::getContent).toList();
	}

	private static byte[] zip(String name, String content) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		try (ZipOutputStream zip = new ZipOutputStream(out)) {
			zip.putNextEntry(new ZipEntry(name));
			zip.write(content.getBytes(StandardCharsets.UTF_8));
			zip.closeEntry();
		}
		return out.toByteArray();
	}
}
