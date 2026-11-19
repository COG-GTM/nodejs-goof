package io.snyk.goof.admin;

import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import io.swagger.v3.oas.annotations.Hidden;

/**
 * Admin login page, admin landing page and account details form. Login/logout processing is done by
 * Spring Security (see {@link io.snyk.goof.security.SecurityConfig}).
 */
@Hidden
@Controller
public class AdminController {

	private static final Logger log = LoggerFactory.getLogger(AdminController.class);

	@GetMapping("/login")
	public String login(@RequestParam(name = "redirectPage", defaultValue = "") String redirectPage, Model model) {
		model.addAttribute("title", "Admin Access");
		model.addAttribute("granted", false);
		model.addAttribute("redirectPage", redirectPage);
		return "admin";
	}

	@GetMapping("/admin")
	public String admin(Model model) {
		model.addAttribute("title", "Admin Access Granted");
		model.addAttribute("granted", true);
		return "admin";
	}

	@GetMapping("/account_details")
	public String accountDetails(Model model) {
		model.addAttribute("profile", AccountDetails.empty());
		return "account";
	}

	@PostMapping("/account_details")
	public String saveAccountDetails(@Valid @ModelAttribute("profile") AccountDetails profile, BindingResult result,
			Model model) {
		if (result.hasErrors()) {
			log.info("error in form details: {}", result.getFieldErrors().stream().map(e -> e.getField()).toList());
			model.addAttribute("profile", AccountDetails.empty());
		}
		else {
			model.addAttribute("profile", profile.withNamesRightTrimmed());
		}
		return "account";
	}
}
