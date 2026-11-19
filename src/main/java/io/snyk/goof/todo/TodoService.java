package io.snyk.goof.todo;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * Todo use cases: listing, creating (with reminder parsing), editing, deleting and bulk import.
 */
@Service
public class TodoService {

	static final String NO_BACKUP = "No backup.txt file found";

	private static final Logger log = LoggerFactory.getLogger(TodoService.class);

	private static final Pattern IMAGE = Pattern.compile("!\\[alt text]\\((http\\S*)\\s\"");

	private static final String BACKUP_ENTRY = "backup.txt";

	private static final int MAX_BACKUP_BYTES = 5 * 1024 * 1024;

	private static final Sort NEWEST_FIRST = Sort.by(Sort.Direction.DESC, "updatedAt", "id");

	private final TodoRepository repository;

	private final Clock clock;

	public TodoService(TodoRepository repository, Clock clock) {
		this.repository = repository;
		this.clock = clock;
	}

	public List<Todo> findAll() {
		return repository.findAll(NEWEST_FIRST);
	}

	public Todo get(String id) {
		return repository.findById(id).orElseThrow(() -> new TodoNotFoundException(id));
	}

	public Todo create(String content) {
		String item = content == null ? "" : content;
		Matcher image = IMAGE.matcher(item);
		if (image.find()) {
			log.info("found img: {}", image.group(1));
		}
		else {
			item = ReminderParser.apply(item);
		}
		return repository.save(new Todo(item, Instant.now(clock)));
	}

	public Todo update(String id, String content) {
		Todo todo = get(id);
		todo.setContent(content);
		todo.setUpdatedAt(Instant.now(clock));
		return repository.save(todo);
	}

	public void delete(String id) {
		repository.delete(get(id));
	}

	/**
	 * Imports one todo per line of {@code what[,when,locale,format]}. A ZIP upload is read in memory
	 * and its {@code backup.txt} entry is imported; nothing is extracted to disk.
	 * @return the number of todos created
	 */
	public int importTodos(byte[] data) {
		String text = isZip(data) ? readBackupEntry(data) : new String(data, StandardCharsets.UTF_8);
		int created = 0;
		for (String rawLine : text.split("\n", -1)) {
			String line = rawLine.endsWith("\r") ? rawLine.substring(0, rawLine.length() - 1) : rawLine;
			String[] parts = line.split(",", -1);
			String item = parts[0];
			if (item.isBlank()) {
				continue;
			}
			String when = part(parts, 1);
			String locale = part(parts, 2);
			String format = part(parts, 3);
			if (!when.isBlank() && !locale.isBlank() && !format.isBlank()) {
				item += " [" + MomentFormat.format(when, locale, format, clock.getZone()) + "]";
			}
			repository.save(new Todo(item, Instant.now(clock)));
			log.debug("imported {}", item);
			created++;
		}
		return created;
	}

	private static String part(String[] parts, int index) {
		return index < parts.length ? parts[index] : "";
	}

	private static boolean isZip(byte[] data) {
		return data.length >= 4 && data[0] == 'P' && data[1] == 'K' && data[2] == 3 && data[3] == 4;
	}

	private static String readBackupEntry(byte[] data) {
		try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(data))) {
			ZipEntry entry;
			boolean empty = true;
			while ((entry = zip.getNextEntry()) != null) {
				empty = false;
				String name = entry.getName().replace('\\', '/');
				String baseName = name.substring(name.lastIndexOf('/') + 1);
				if (!entry.isDirectory() && BACKUP_ENTRY.equals(baseName)) {
					return new String(readLimited(zip), StandardCharsets.UTF_8);
				}
			}
			if (empty) {
				throw new InvalidImportFileException("The uploaded ZIP file has no entries", null);
			}
			return NO_BACKUP;
		}
		catch (IOException ex) {
			throw new InvalidImportFileException("The uploaded ZIP file could not be read", ex);
		}
	}

	private static byte[] readLimited(InputStream in) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		byte[] buffer = new byte[8192];
		int read;
		while ((read = in.read(buffer)) != -1) {
			if (out.size() + read > MAX_BACKUP_BYTES) {
				throw new IOException("backup.txt exceeds " + MAX_BACKUP_BYTES + " bytes");
			}
			out.write(buffer, 0, read);
		}
		return out.toByteArray();
	}
}
