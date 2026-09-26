import { FailureOutput, TestRows } from "./TestResults";
import { coverageSummary } from "./coverage-summary";
import type { SuiteRun } from "./types";

export function CoverageSummary({ before, after, selectedTests, showAreas = true }: { before?: SuiteRun; after?: SuiteRun; selectedTests: string[] | null; showAreas?: boolean }) {
    const summary = coverageSummary(before, after, selectedTests);
    const metrics = [["Executed", summary.executed], ["Passed", summary.passed], ["Failed", summary.failed], ["Skipped", summary.skipped], ["Flaky", summary.flaky], ["Expected failures", summary.expectedFailures]] as const;
    return <section className="coverage-summary" aria-label="Test coverage summary">
        <div className="heading"><h4>Test evidence</h4><span className="badge">{summary.run ? `${after ? "After" : "Before"} #${summary.run.id} · ${summary.run.status}` : "Not run"}</span></div>
        <p className="evidence-scope">Results apply to this suite and selected run. Code coverage is not measured.</p>
        {!summary.hasReport ? <p>No test report available.</p> : <>
            {summary.run?.status !== "complete" && <p className="notice error">Incomplete run. Counts reflect available evidence only.</p>}
            <dl className="test-metrics">{metrics.map(([label, value]) => <div key={label} className={label === "Failed" && value ? "test-failure" : ""}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {!!summary.run?.report?.errors?.length && <p role="alert">{summary.run.report.errors.length} runner errors</p>}
        </>}
        <div className="evidence-counts">
            <span>New tests: <strong>{summary.added?.length ?? "Not compared"}</strong></span>
            <span>Removed tests: <strong>{summary.removed?.length ?? "Not compared"}</strong></span>
            <span>Selected video pairs: <strong>{summary.paired}</strong></span>
            <span>Before-only videos: <strong>{summary.beforeOnly}</strong></span>
            <span>After-only videos: <strong>{summary.afterOnly}</strong></span>
        </div>
        {(!!summary.added?.length || !!summary.removed?.length) && <details><summary>Test inventory changes</summary>
            {summary.added?.map(test => <p key={`new-${test.key}`}><span className="contract-status added">New</span> {test.title} · {test.project} · {test.outcome}</p>)}
            {summary.removed?.map(test => <p key={`removed-${test.key}`}><span className="contract-status removed">Removed</span> {test.title} · {test.project}</p>)}
        </details>}
        <details className="coverage-gaps" hidden={!showAreas}><summary>Changed areas: {summary.comparableContracts ? `${summary.missingEvidence} without identified coverage / ${summary.areas.length} changed files` : "Not compared"}</summary>
            {!summary.comparableContracts ? <p>Two completed runs with source snapshots are required.</p> : <>
                <p>Scope: scanned contract files. Test links are declarations, not proof of exercised code paths.</p>
                {summary.warnings.length > 0 && <p className="notice error">Source inventory is partial. {summary.warnings.length} source warnings are recorded in Dev details.</p>}
                {!summary.areas.length && <p>No changes detected in scanned contracts.</p>}
                {summary.areas.map(area => <div className="coverage-area" key={area.file}><div><code>{area.file}</code><span className="badge">{area.linkedTests.length ? `${area.linkedTests.length} declared test links` : "Coverage not identified"}</span></div><small>{area.categories.join(" · ")}</small>
                    <TestRows tests={area.linkedTests} run={after} />
                </div>)}
            </>}
        </details>
        <FailureOutput run={summary.run} />
    </section>;
}
