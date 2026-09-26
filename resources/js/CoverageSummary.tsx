import { useState, type ReactNode } from "react";
import { FailureOutput, TestRows } from "./TestResults";
import { coverageSummary, wasExecuted } from "./coverage-summary";
import type { SuiteCase, SuiteRun } from "./types";

type Metric = "Executed" | "Passed" | "Failed" | "Skipped" | "Flaky" | "Expected failures";

function matchesMetric(test: SuiteCase, metric: Metric): boolean {
    if (metric === "Executed") return wasExecuted(test);
    if (metric === "Passed") return test.outcome === "expected" && test.attempts.at(-1)?.status === "passed";
    if (metric === "Failed") return test.outcome === "unexpected";
    if (metric === "Skipped") return test.outcome === "skipped";
    if (metric === "Flaky") return test.outcome === "flaky";
    return test.outcome === "expected" && test.expectedStatus === "failed";
}

export function CoverageSummary({ before, after, selectedTests, controls, runLabel, suiteName, children }: { before?: SuiteRun; after?: SuiteRun; selectedTests: string[] | null; controls?: ReactNode; runLabel?: string; suiteName?: string; children?: ReactNode }) {
    const [selectedMetric, setSelectedMetric] = useState<Metric | null>(null);
    const summary = coverageSummary(before, after, selectedTests);
    const metrics: [Metric, number][] = [["Executed", summary.executed], ["Passed", summary.passed], ["Failed", summary.failed], ["Skipped", summary.skipped], ["Flaky", summary.flaky], ["Expected failures", summary.expectedFailures]];
    const metricTests = selectedMetric
        ? (summary.run?.report?.tests ?? []).filter((test) => matchesMetric(test, selectedMetric))
        : [];
    return <section className="coverage-summary" aria-label="Test coverage summary">
        <div className="heading"><h4>Test evidence</h4><div className="evidence-heading-controls">{controls}<span className="badge">{summary.run ? runLabel ?? `${after ? "After" : "Before"} #${summary.run.id} · ${summary.run.status}` : "Not run"}</span></div></div>
        <p className="evidence-scope">Results apply to {runLabel ? "the latest runs across all suites" : "this suite and selected run"}. Code coverage is not measured.</p>
        {!summary.hasReport ? <p>No test report available.</p> : <>
            {summary.run?.status !== "complete" && <p className="notice error">Incomplete run. Counts reflect available evidence only.</p>}
            <div className="test-metrics">{metrics.map(([label, value]) => <button type="button" key={label} className={label === "Failed" && value ? "test-failure" : ""} aria-pressed={selectedMetric === label} onClick={() => setSelectedMetric(selectedMetric === label ? null : label)}><span>{label}</span><strong className="metric-value">{value}</strong></button>)}</div>
            {selectedMetric && <section className="metric-test-viewer" aria-label={`${selectedMetric} tests`}>
                <div className="metric-test-viewer-heading"><strong>{selectedMetric} tests</strong><span>{metricTests.length}</span></div>
                {metricTests.length ? <TestRows tests={metricTests} run={summary.run} /> : <p>No tests in this category.</p>}
            </section>}
            {!!summary.run?.report?.errors?.length && <p role="alert">{summary.run.report.errors.length} runner errors</p>}
        </>}
        <div className="evidence-counts">
            <span>New tests: <strong>{summary.added?.length ?? "Not compared"}</strong></span>
            <span>Removed tests: <strong>{summary.removed?.length ?? "Not compared"}</strong></span>
            <span>Selected video pairs: <strong>{summary.paired}</strong></span>
            <span>Before-only videos: <strong>{summary.beforeOnly}</strong></span>
            <span>After-only videos: <strong>{summary.afterOnly}</strong></span>
        </div>
        <FailureOutput run={summary.run} suiteName={suiteName} />
        {children}
    </section>;
}
