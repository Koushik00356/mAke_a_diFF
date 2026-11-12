package com.firstdiff.github;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Thin wrapper around GitHub's REST API.
 * Reads the token from the GH_TOKEN environment variable.
 * Works without a token too (lower rate limits) - handy for local dev.
 */
@Component
public class GitHubClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST =
            new ParameterizedTypeReference<>() {};

    private final RestClient client;

    public GitHubClient() {
        String token = System.getenv("GH_TOKEN");
        RestClient.Builder b = RestClient.builder()
                .baseUrl("https://api.github.com")
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28");
        if (token != null && !token.isBlank()) {
            b.defaultHeader("Authorization", "Bearer " + token.trim());
        }
        this.client = b.build();
    }

    /** GET a GitHub endpoint and return the JSON body as a Map. */
    public Map<String, Object> get(Function<UriBuilder, URI> uri) {
        return fetch(uri, MAP);
    }

    /** GET a GitHub endpoint whose body is a JSON array (e.g. /pulls). */
    public List<Map<String, Object>> getList(Function<UriBuilder, URI> uri) {
        return fetch(uri, LIST);
    }

    private <T> T fetch(Function<UriBuilder, URI> uri, ParameterizedTypeReference<T> type) {
        try {
            return client.get()
                    .uri(uri)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        throw mapError(res.getStatusCode().value());
                    })
                    .body(type);
        } catch (ResourceAccessException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not reach GitHub.");
        }
    }

    /** 403/429 -> rate limit, 422 -> filter too narrow, 404 passes through, the rest -> 502. */
    private static ResponseStatusException mapError(int code) {
        return switch (code) {
            case 403, 429 -> new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "GitHub rate limit reached. Set GH_TOKEN for higher limits, or wait a minute.");
            case 422 -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Filter too narrow - GitHub rejected this combination. Loosen a filter and rescan.");
            case 404 -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found on GitHub.");
            default -> new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub returned " + code + ".");
        };
    }
}
