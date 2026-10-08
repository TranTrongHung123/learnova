package com.learnova.identity.config;

import com.learnova.identity.service.AdminBootstrapService;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "learnova.admin.bootstrap.enabled", havingValue = "true")
public class AdminBootstrapConfiguration {

    @Bean
    ApplicationRunner bootstrapAdmin(AdminBootstrapService service, Environment environment) {
        return args ->
            service.bootstrap(
                environment.getProperty("learnova.admin.bootstrap.email"),
                environment.getProperty("learnova.admin.bootstrap.password"),
                environment.getProperty("learnova.admin.bootstrap.display-name")
            );
    }
}
