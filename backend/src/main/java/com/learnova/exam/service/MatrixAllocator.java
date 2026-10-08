package com.learnova.exam.service;

import com.learnova.exam.dto.ExamDtos.*;
import com.learnova.question.dto.QuestionDtos.ExamCandidate;
import java.util.*;

/** Phân bổ lại các câu đã chọn để rule rộng không chiếm mất câu duy nhất của rule hẹp. */
final class MatrixAllocator {

    record Allocation(List<List<ExamCandidate>> selected, List<RuleAvailability> availability) {
        boolean complete() {
            return availability.stream().allMatch(row -> row.missingCount() == 0);
        }
    }

    static Allocation allocate(
        List<MatrixRule> rules,
        List<List<ExamCandidate>> candidates,
        boolean randomize
    ) {
        var pools = new ArrayList<List<ExamCandidate>>();
        for (var pool : candidates) {
            var copy = new ArrayList<>(pool);
            if (randomize) Collections.shuffle(copy);
            pools.add(copy);
        }
        var slotRules = new ArrayList<Integer>();
        for (int i = 0; i < rules.size(); i++) for (
            int j = 0;
            j < rules.get(i).quantity();
            j++
        ) slotRules.add(i);
        var assigned = new ExamCandidate[slotRules.size()];
        var owners = new HashMap<UUID, Integer>();
        for (int slot = 0; slot < assigned.length; slot++) augment(
            slot,
            slotRules,
            pools,
            assigned,
            owners,
            new HashSet<>()
        );

        var selected = new ArrayList<List<ExamCandidate>>();
        for (int i = 0; i < rules.size(); i++) selected.add(new ArrayList<>());
        for (int slot = 0; slot < assigned.length; slot++) if (assigned[slot] != null) selected
            .get(slotRules.get(slot))
            .add(assigned[slot]);
        var availability = new ArrayList<RuleAvailability>();
        for (int i = 0; i < rules.size(); i++) {
            int requested = rules.get(i).quantity(),
                allocated = selected.get(i).size();
            availability.add(
                new RuleAvailability(
                    i,
                    requested,
                    pools.get(i).size(),
                    allocated,
                    requested - allocated
                )
            );
        }
        return new Allocation(
            selected.stream().map(List::copyOf).toList(),
            List.copyOf(availability)
        );
    }

    private static boolean augment(
        int slot,
        List<Integer> slotRules,
        List<List<ExamCandidate>> pools,
        ExamCandidate[] assigned,
        Map<UUID, Integer> owners,
        Set<UUID> visited
    ) {
        for (var candidate : pools.get(slotRules.get(slot))) {
            if (!visited.add(candidate.id())) continue;
            var previous = owners.get(candidate.id());
            if (
                previous == null || augment(previous, slotRules, pools, assigned, owners, visited)
            ) {
                owners.put(candidate.id(), slot);
                assigned[slot] = candidate;
                return true;
            }
        }
        return false;
    }
}
