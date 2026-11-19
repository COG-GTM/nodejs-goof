package io.snyk.goof.todo;

import org.commonmark.parser.Parser;
import org.commonmark.renderer.html.HtmlRenderer;
import org.springframework.stereotype.Component;

/**
 * Renders todo content as Markdown with raw HTML escaped and unsafe URLs removed (the legacy
 * build used {@code marked} with {@code sanitize: true}).
 */
@Component
public class MarkdownRenderer {

	private final Parser parser = Parser.builder().build();

	private final HtmlRenderer renderer = HtmlRenderer.builder().escapeHtml(true).sanitizeUrls(true).build();

	public String render(String markdown) {
		return renderer.render(parser.parse(markdown == null ? "" : markdown));
	}
}
