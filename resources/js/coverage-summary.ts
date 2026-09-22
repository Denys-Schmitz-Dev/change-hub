import type { ContractCategory, ContractEntry, SuiteCase, SuiteRun } from "./types.ts";

export const contractCategories: [ContractCategory, string][] = [["api", "API requests and handlers"], ["routes", "Routes"], ["ui", "UI components and navigation"], ["state", "State and stores"], ["data", "Data models and types"], ["dependencies", "Dependencies"]];

export function contractChanges(before: ContractEntry[], after: ContractEntry[]) {
    const left = new Map(before.map(entry => [entry.key, entry]));
    const right = new Map(after.map(entry => [entry.key, entry]));
    return [...new Set([...left.keys(), ...right.keys()])].flatMap(key => {
        const a = left.get(key), b = right.get(key);
        return a?.hash === b?.hash ? [] : [{ key, before: a, after: b, status: !a ? "Added" : !b ? "Removed" : "Changed" }];
    });
}

export function wasExecuted(test: SuiteCase) {
    return test.attempts.some(attempt => ["passed", "failed", "timedOut", "interrupted"].includes(attempt.status));
}

export function coverageSummary(before: SuiteRun | undefined, after: SuiteRun | undefined, selected: string[] | null) {
    // A pending/failed after run must not silently fall back to a successful baseline.
    const run = after ?? before;
    const tests = run?.report?.tests ?? [];
    const comparableTests = !!before?.report && !!after?.report && before.status === "complete" && after.status === "complete";
    const beforeKeys = new Set(before?.report?.tests.map(test => test.key));
    const afterKeys = new Set(after?.report?.tests.map(test => test.key));
    const selectedVideos = (value?: SuiteRun) => new Set(value?.report?.tests.flatMap(test =>
        selected !== null && !selected.includes(test.key) ? [] : test.attachments.filter(attachment => attachment.contentType === "video/webm").map(attachment => attachment.key)) ?? []);
    const leftVideos = selectedVideos(before), rightVideos = selectedVideos(after);
    const paired = [...leftVideos].filter(key => rightVideos.has(key)).length;
    const left = before?.report?.contracts, right = after?.report?.contracts;
    const comparableContracts = comparableTests && left?.version === 1 && right?.version === 1;
    const files = new Map<string, Set<string>>();
    if (comparableContracts) {
        for (const [category, label] of contractCategories) {
            for (const change of contractChanges(left!.categories[category] ?? [], right!.categories[category] ?? [])) {
                for (const file of new Set([change.before?.file, change.after?.file].filter((file): file is string => !!file))) {
                    if (!files.has(file)) files.set(file, new Set());
                    files.get(file)!.add(label);
                }
            }
        }
    }
    const areas = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, categories]) => ({
        file, categories: [...categories],
        linkedTests: (after?.report?.tests ?? []).filter(test => wasExecuted(test) && test.coveredFiles?.includes(file)),
    }));
    return {
        run, hasReport: !!run?.report,
        executed: tests.filter(wasExecuted).length,
        passed: tests.filter(test => test.outcome === "expected" && test.attempts.at(-1)?.status === "passed").length,
        failed: tests.filter(test => test.outcome === "unexpected").length,
        skipped: tests.filter(test => test.outcome === "skipped").length,
        flaky: tests.filter(test => test.outcome === "flaky").length,
        expectedFailures: tests.filter(test => test.outcome === "expected" && test.expectedStatus === "failed").length,
        added: comparableTests ? tests.filter(test => !beforeKeys.has(test.key)) : null,
        removed: comparableTests ? (before?.report?.tests ?? []).filter(test => !afterKeys.has(test.key)) : null,
        paired, beforeOnly: leftVideos.size - paired, afterOnly: rightVideos.size - paired,
        comparableContracts, areas,
        missingEvidence: areas.filter(area => area.linkedTests.length === 0).length,
        warnings: [...(left?.warnings ?? []), ...(right?.warnings ?? [])],
    };
}
