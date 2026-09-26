package com.learnova.shared.api;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public record PageQuery(int page, int size) {
    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 100;

    public PageQuery {
        if (page < 0) {
            throw new InvalidPaginationException("page", "Must be greater than or equal to 0.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new InvalidPaginationException("size", "Must be between 1 and 100.");
        }
    }

    public Pageable toPageable(Sort sort) {
        return PageRequest.of(page, size, sort);
    }
}
