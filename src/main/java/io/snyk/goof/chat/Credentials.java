package io.snyk.goof.chat;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "Credentials")
public record Credentials(String name, String password) {
}
