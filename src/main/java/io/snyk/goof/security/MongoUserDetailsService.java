package io.snyk.goof.security;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsPasswordService;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import io.snyk.goof.admin.EmailAddress;

/**
 * Loads admins from MongoDB. Usernames must be email addresses. Legacy plaintext passwords are
 * re-hashed with the current encoder after a successful login.
 */
@Service
public class MongoUserDetailsService implements UserDetailsService, UserDetailsPasswordService {

	private final LoginUserRepository users;

	public MongoUserDetailsService(LoginUserRepository users) {
		this.users = users;
	}

	@Override
	public UserDetails loadUserByUsername(String username) {
		if (!EmailAddress.isValid(username)) {
			throw new UsernameNotFoundException("Username must be an email address");
		}
		LoginUser user = users.findFirstByUsername(username)
			.orElseThrow(() -> new UsernameNotFoundException("Unknown user"));
		return User.withUsername(user.getUsername()).password(user.getPassword()).roles("ADMIN").build();
	}

	@Override
	public UserDetails updatePassword(UserDetails user, String newPassword) {
		users.findFirstByUsername(user.getUsername()).ifPresent(stored -> {
			stored.setPassword(newPassword);
			users.save(stored);
		});
		return User.withUserDetails(user).password(newPassword).build();
	}
}
