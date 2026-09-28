package com.learnova;

import org.springframework.boot.SpringApplication;

public class TestLearnovaBackendApplication {

	public static void main(String[] args) {
		// DevTools gọi lại main sẽ khởi tạo provider test hai lần trong cùng JVM.
		System.setProperty("spring.devtools.restart.enabled", "false");
		if (java.util.Arrays.asList(args).contains("--learnova.test.google=true")) {
			var provider = new com.learnova.identity.FakeGoogleProvider(8092);
			Runtime.getRuntime().addShutdownHook(new Thread(provider::close));
			System.setProperty("learnova.auth.google.enabled", "true");
			System.setProperty("learnova.auth.google.client-id", "test-client");
			System.setProperty("learnova.auth.google.client-secret", "test-secret");
			System.setProperty("learnova.auth.google.authorization-uri", provider.baseUrl() + "/authorize");
			System.setProperty("learnova.auth.google.token-uri", provider.baseUrl() + "/token");
			System.setProperty("learnova.auth.google.jwk-set-uri", provider.baseUrl() + "/jwks");
		}
		SpringApplication.from(LearnovaBackendApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
