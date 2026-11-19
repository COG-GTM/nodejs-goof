package io.snyk.goof.security;

import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface LoginUserRepository extends MongoRepository<LoginUser, String> {

	Optional<LoginUser> findFirstByUsername(String username);
}
