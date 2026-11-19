package io.snyk.goof.users;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Row of the MySQL {@code users} table.
 */
@Entity
@Table(name = "users")
public class UserRecord {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer id;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String address;

	@Column(nullable = false)
	private String role;

	protected UserRecord() {
	}

	public UserRecord(String name, String address, String role) {
		this.name = name;
		this.address = address;
		this.role = role;
	}

	public Integer getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public String getAddress() {
		return address;
	}

	public String getRole() {
		return role;
	}
}
