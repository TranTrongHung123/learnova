package com.learnova.attempt.service;

import java.time.Instant;

public final class ResultVisibility {
    private ResultVisibility() {}
    public static String availability(String mode, String policy, Instant end, Instant released, Instant now, boolean graded) {
        if (mode.equals("HIDDEN")) return "HIDDEN";
        if (!graded) return "PENDING_GRADING";
        boolean visible=switch(policy) {
            case "IMMEDIATE" -> true;
            case "AFTER_SESSION_END" -> !now.isBefore(end);
            case "MANUAL" -> released!=null;
            default -> false;
        };
        return visible?"AVAILABLE":"PENDING_RELEASE";
    }
}
