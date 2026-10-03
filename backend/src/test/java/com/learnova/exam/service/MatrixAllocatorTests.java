package com.learnova.exam.service;

import com.learnova.exam.dto.ExamDtos.MatrixRule;
import com.learnova.question.dto.QuestionDtos.ExamCandidate;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class MatrixAllocatorTests {
    private final ExamCandidate a = candidate(1), b = candidate(2), c = candidate(3);
    @Test void disjointRulesAndEmptyPoolsReportTheirActualShortfall() {
        var result = MatrixAllocator.allocate(List.of(rule(2), rule(1), rule(1)), List.of(List.of(a, b), List.of(c), List.of()), false);
        assertThat(result.complete()).isFalse();
        assertThat(result.availability()).extracting(r -> r.missingCount()).containsExactly(0, 0, 1);
    }
    @Test void broadRuleReleasesTheOnlyCandidateOfNarrowRule() {
        for (boolean randomize : List.of(false, true)) {
            var result = MatrixAllocator.allocate(List.of(rule(2), rule(1)), List.of(List.of(a, b, c), List.of(a)), randomize);
            assertThat(result.complete()).isTrue();
            assertThat(result.selected().get(0)).containsExactlyInAnyOrder(b, c);
            assertThat(result.selected().get(1)).containsExactly(a);
        }
    }
    @Test void overlappingAndIdenticalRulesCannotCountOneQuestionTwice() {
        var result = MatrixAllocator.allocate(List.of(rule(2), rule(2)), List.of(List.of(a, b, c), List.of(a, b, c)), false);
        assertThat(result.complete()).isFalse();
        assertThat(result.availability()).extracting(r -> r.candidateCount()).containsExactly(3, 3);
        assertThat(result.availability()).extracting(r -> r.allocatedCount()).containsExactly(2, 1);
        assertThat(result.selected().stream().flatMap(List::stream).toList()).doesNotHaveDuplicates();
    }
    @Test void randomizedSmallGraphsMatchExhaustiveMaximumAndAlwaysRespectEdges() {
        var random = new Random(10);
        var all = List.of(a, b, c, candidate(4), candidate(5));
        for (int iteration = 0; iteration < 200; iteration++) {
            var rules = List.of(rule(1), rule(2), rule(1));
            var pools = new ArrayList<List<ExamCandidate>>();
            for (int i = 0; i < rules.size(); i++) pools.add(all.stream().filter(q -> random.nextBoolean()).toList());
            var slots = List.of(pools.get(0), pools.get(1), pools.get(1), pools.get(2));
            var result = MatrixAllocator.allocate(rules, pools, true);
            var selected = result.selected().stream().flatMap(List::stream).toList();
            assertThat(selected).hasSize(maximum(slots, 0, new HashSet<>())).doesNotHaveDuplicates();
            for (int i = 0; i < rules.size(); i++) assertThat(pools.get(i)).containsAll(result.selected().get(i));
        }
    }
    private int maximum(List<List<ExamCandidate>> slots, int index, Set<ExamCandidate> used) {
        if (index == slots.size()) return 0;
        int best = maximum(slots, index + 1, used);
        for (var q : slots.get(index)) if (used.add(q)) {
            best = Math.max(best, 1 + maximum(slots, index + 1, used)); used.remove(q);
        }
        return best;
    }
    private static MatrixRule rule(int quantity) { return new MatrixRule(null, null, null, quantity); }
    private static ExamCandidate candidate(long id) { return new ExamCandidate(new UUID(0, id), 0); }
}
