package io.snyk.goof.about;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import io.swagger.v3.oas.annotations.Hidden;

@Hidden
@Controller
public class AboutController {

	@GetMapping("/about_new")
	public String about(@RequestParam(name = "device", required = false) String device, Model model) {
		model.addAttribute("title", "Patch TODO List");
		model.addAttribute("subhead", "Vulnerabilities at their best");
		model.addAttribute("device", device);
		return "about_new";
	}
}
