package com.firstdiff.github;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.Map;
import java.util.function.Function;
import org.springframework.web.util.UriBuilder;
import java.net.URI;

/**
 * Thin wrapper around GitHub's REST API.
 * Reads the token from the GH_TOKEN environment variable.
 * Works without a token too (lower rate limits) - handy for local dev.
 */
@Component
public class GitHubClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    private final RestClient client;

    public GitHubClient() {
        String token = System.getenv("GH_TOKEN");
        RestClient.Builder b = RestClient.builder()
                .baseUrl("https://api.github.com")
                .defaultHeader("Accept", "application/vnd.github+json")
                .defaultHeader("X-GitHub-Api-Version", "2022-11-28");
        if (token != null && !token.isBlank()) {
            b.defaultHeader("Authorization", "Bearer " + token);
        }
        this.client = b.build();
    }

    private static final ParameterizedTypeReference<java.util.List<Map<String, Object>>> LIST =
            new ParameterizedTypeReference<>() {};

    /** GET a GitHub endpoint whose body is a JSON array (e.g. /pulls). */
    public java.util.List<Map<String, Object>> getList(Function<UriBuilder, URI> uri) {
        return client.get()
                .uri(uri)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> { throw mapError(res.getStatusCode().value()); })
                .body(LIST);
    }

    /** GET a GitHub endpoint and return the JSON body as a Map. */
    public Map<String, Object> get(Function<UriBuilder, URI> uri) {
        return client.get()
                .uri(uri)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, res) -> { throw mapError(res.getStatusCode().value()); })
                .body(MAP);
    }

    private static ResponseStatusException mapError(int code) {
        HttpStatus status = HttpStatus.valueOf(code);
        String msg = switch (status) {
            case FORBIDDEN, TOO_MANY_REQUESTS ->
                    "GitHub rate limit reached. Set GH_TOKEN for higher limits, or wait a minute.";
            case NOT_FOUND -> "Not found on GitHub.";
            case UNPROCESSABLE_ENTITY -> "GitHub rejected the search query - check filter values.";
            default -> "GitHub returned " + status.value() + ".";
        };
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, msg);
    }
}
