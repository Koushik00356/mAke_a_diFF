package com.firstdiff.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Function;

/**
 * One GitHub search per value, in parallel on virtual threads, merged and
 * de-duplicated by id. GitHub ANDs multiple labels/topics inside one query,
 * which shrinks results; parallel-then-merge gives OR.
 *
 * A failed value degrades the result (it is listed in {@code failed}) instead
 * of breaking it. Only when every value fails is the error rethrown.
 */
final class FanOut {

    private static final ExecutorService VT = Executors.newVirtualThreadPerTaskExecutor();

    record Result(List<Map<String, Object>> items, List<String> failed, long matched) {}

    private record Outcome(Map<String, Object> body, RuntimeException error) {}

    private FanOut() {}

    static Result run(List<String> values, Function<String, Map<String, Object>> search) {
        List<CompletableFuture<Outcome>> futures = values.stream()
                .map(v -> CompletableFuture.supplyAsync(() -> search.apply(v), VT)
                        .handle((body, ex) -> new Outcome(body, unwrap(ex))))
                .toList();

        Map<Object, Map<String, Object>> merged = new LinkedHashMap<>();
        List<String> failed = new ArrayList<>();
        RuntimeException firstError = null;
        long matched = 0;

        for (int i = 0; i < futures.size(); i++) {
            Outcome o = futures.get(i).join();
            if (o.error() != null || o.body() == null) {
                failed.add(values.get(i));
                if (firstError == null) firstError = o.error();
                continue;
            }
            if (o.body().get("total_count") instanceof Number n) matched += n.longValue();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items =
                    (List<Map<String, Object>>) o.body().getOrDefault("items", List.of());
            for (Map<String, Object> item : items) merged.putIfAbsent(item.get("id"), item);
        }

        if (!values.isEmpty() && failed.size() == values.size()) {
            throw firstError != null ? firstError
                    : new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub search failed.");
        }
        return new Result(new ArrayList<>(merged.values()), failed, matched);
    }

    private static RuntimeException unwrap(Throwable ex) {
        if (ex == null) return null;
        Throwable t = ex instanceof CompletionException && ex.getCause() != null ? ex.getCause() : ex;
        return t instanceof RuntimeException re ? re
                : new ResponseStatusException(HttpStatus.BAD_GATEWAY, "GitHub search failed.");
    }
}
