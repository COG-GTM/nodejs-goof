package io.snyk.goof.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import io.snyk.goof.security.LoginUser;
import io.snyk.goof.security.LoginUserRepository;
import io.snyk.goof.users.UserRecord;
import io.snyk.goof.users.UserRecordRepository;

/**
 * Seeds the admin login (MongoDB) and the two demo user records (MySQL) when they are missing.
 */
@Component
public class DataSeeder implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

	private final LoginUserRepository loginUsers;

	private final UserRecordRepository userRecords;

	private final PasswordEncoder passwordEncoder;

	private final String adminUsername;

	private final String adminPassword;

	public DataSeeder(LoginUserRepository loginUsers, UserRecordRepository userRecords, PasswordEncoder passwordEncoder,
			@Value("${goof.admin.username}") String adminUsername,
			@Value("${goof.admin.password}") String adminPassword) {
		this.loginUsers = loginUsers;
		this.userRecords = userRecords;
		this.passwordEncoder = passwordEncoder;
		this.adminUsername = adminUsername;
		this.adminPassword = adminPassword;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (loginUsers.findFirstByUsername(adminUsername).isEmpty()) {
			log.info("Seeding admin user {}", adminUsername);
			loginUsers.save(new LoginUser(adminUsername, passwordEncoder.encode(adminPassword)));
		}
		if (userRecords.count() == 0) {
			log.info("Seeding 2 users to MySQL users table: Liran (role: user), Simon (role: admin)");
			userRecords.save(new UserRecord("Liran", "IL", "user"));
			userRecords.save(new UserRecord("Simon", "UK", "admin"));
		}
	}
}
