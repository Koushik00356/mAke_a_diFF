package com.firstdiff;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class FirstDiffApplication {
    public static void main(String[] args) {
        SpringApplication.run(FirstDiffApplication.class, args);
    }
}
