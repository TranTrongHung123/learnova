package com.learnova;

import org.springframework.boot.SpringApplication;

public class TestLearnovaBackendApplication {

	public static void main(String[] args) {
		SpringApplication.from(LearnovaBackendApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
