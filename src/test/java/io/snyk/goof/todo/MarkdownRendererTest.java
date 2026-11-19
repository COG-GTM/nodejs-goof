package io.snyk.goof.todo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MarkdownRendererTest {

	private final MarkdownRenderer renderer = new MarkdownRenderer();

	@Test
	void rendersMarkdown() {
		assertThat(renderer.render("**bold** and _it_")).contains("<strong>bold</strong>").contains("<em>it</em>");
	}

	@Test
	void escapesRawHtml() {
		String html = renderer.render("<script>alert(1)</script>");
		assertThat(html).doesNotContain("<script>").contains("&lt;script&gt;");
	}

	@Test
	void dropsJavascriptLinks() {
		assertThat(renderer.render("[x](javascript:alert(1))")).doesNotContain("javascript:");
	}

	@Test
	void handlesNull() {
		assertThat(renderer.render(null)).isEmpty();
	}
}
