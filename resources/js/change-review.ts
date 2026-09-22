import {
    contractCategories,
    contractChanges,
    wasExecuted,
} from "./coverage-summary.ts";
import type { SuiteRun } from "./types";

export function changeReview(before?: SuiteRun, after?: SuiteRun) {
    const left = before?.report?.contracts,
        right = after?.report?.contracts;
    const comparable =
        before?.status === "complete" &&
        after?.status === "complete" &&
        left?.version === 1 &&
        right?.version === 1;
    const changes = comparable
        ? contractCategories.flatMap(([key, category]) =>
              contractChanges(
                  left.categories[key] ?? [],
                  right.categories[key] ?? [],
              ).map((change) => ({ ...change, category })),
          )
        : [];
    const files = [
        ...new Set(
            changes.flatMap((change) =>
                [change.before?.file, change.after?.file].filter(
                    (file): file is string => !!file,
                ),
            ),
        ),
    ].sort();
    const areas = files.map((file) => {
        const contracts = changes.filter(
            (change) =>
                change.before?.file === file || change.after?.file === file,
        );
        const tests = (after?.report?.tests ?? []).filter((test) =>
            test.coveredFiles?.includes(file),
        );
        const executed = tests.filter(wasExecuted);
        const gaps: string[] = [];
        if (!tests.length) gaps.push("No linked test");
        else if (!executed.length) gaps.push("Linked tests not executed");
        if (tests.some((test) => test.outcome === "unexpected"))
            gaps.push("Failed test");
        if (tests.some((test) => test.outcome === "flaky"))
            gaps.push("Flaky test");
        if (tests.some((test) => !wasExecuted(test)))
            gaps.push("Unexecuted test");
        if (
            executed.length &&
            executed.some(
                (test) => !test.diagnostics || test.diagnostics.warnings.length,
            )
        )
            gaps.push("Incomplete runtime evidence");
        if (
            executed.length &&
            executed.some(
                (test) =>
                    !test.attachments.some(
                        (attachment) =>
                            attachment.contentType === "image/png" ||
                            attachment.contentType === "video/webm",
                    ),
            )
        )
            gaps.push("Missing visual evidence");
        return { file, contracts, tests, gaps, executed: executed.length };
    });
    return {
        comparable,
        areas,
        changed: changes.length,
        needsAttention: areas.filter((area) => area.gaps.length).length,
        warnings: [...(left?.warnings ?? []), ...(right?.warnings ?? [])],
    };
}
