package com.firstdiff.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;

/**
 * Two in-memory caches with different lifetimes:
 *  - "search":  issue/repo search results, refreshed every 30 min
 *  - "health":  repo health scores (expensive: ~3 GitHub calls each), kept 3 h
 *
 * Caffeine is in-process, so a restart clears everything - fine for v1.
 * Swap for Redis later if you deploy multiple instances.
 */
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(
            @Value("${firstdiff.cache.search-ttl-minutes}") long searchTtl,
            @Value("${firstdiff.cache.health-ttl-minutes}") long healthTtl) {

        var search = new CaffeineCache("search",
                Caffeine.newBuilder()
                        .expireAfterWrite(Duration.ofMinutes(searchTtl))
                        .maximumSize(2_000)
                        .build());

        var health = new CaffeineCache("health",
                Caffeine.newBuilder()
                        .expireAfterWrite(Duration.ofMinutes(healthTtl))
                        .maximumSize(5_000)
                        .build());

        var mgr = new SimpleCacheManager();
        mgr.setCaches(List.of(search, health));
        return mgr;
    }
}
