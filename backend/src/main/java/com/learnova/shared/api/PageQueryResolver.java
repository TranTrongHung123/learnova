package com.learnova.shared.api;

import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

public class PageQueryResolver implements HandlerMethodArgumentResolver {
    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.getParameterType() == PageQuery.class;
    }

    @Override
    public PageQuery resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
            NativeWebRequest request, WebDataBinderFactory factory) {
        return new PageQuery(read(request, "page", 0), read(request, "size", PageQuery.DEFAULT_SIZE));
    }

    private int read(NativeWebRequest request, String name, int defaultValue) {
        String[] values = request.getParameterValues(name);
        if (values == null) {
            return defaultValue;
        }
        if (values.length != 1 || !values[0].matches("[0-9]+")) {
            throw new InvalidPaginationException(name, "Must be a single non-negative integer.");
        }
        try {
            return Integer.parseInt(values[0]);
        } catch (NumberFormatException ex) {
            throw new InvalidPaginationException(name, "Must be an integer no greater than 2147483647.");
        }
    }
}
