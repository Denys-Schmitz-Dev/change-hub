import { useState } from "react";
import { plainOutput } from "./plain-output";
import type { SuiteCase, SuiteRun } from "./types";

function result(test: SuiteCase) {
    if (test.outcome === "flaky") return "FLAKY";
    if (test.outcome === "skipped") return "SKIP";
    if (test.outcome === "unexpected") return "FAIL";
    if (test.expectedStatus !== "passed") return "EXPECTED FAILURE";
    return test.attempts.at(-1)?.status === "passed" ? "PASS" : "NOT COMPLETED";
}

export function TestExplorer({
    runs,
    initialRun,
}: {
    runs: SuiteRun[];
    initialRun?: SuiteRun;
}) {
    const [runId, setRunId] = useState(initialRun?.id);
    const [testKey, setTestKey] = useState<string>();
    const [channel, setChannel] = useState("output");
    const [history, setHistory] = useState(false);
    const [query, setQuery] = useState("");
    const run =
        runs.find((run) => run.id === runId) ?? initialRun ?? runs.at(-1);
    const tests = [...(run?.report?.tests ?? [])].sort(
        (a, b) =>
            Number(["unexpected", "flaky"].includes(b.outcome)) -
            Number(["unexpected", "flaky"].includes(a.outcome)),
    );
    const visibleTests = tests.filter((test) =>
        `${test.title} ${test.file ?? ""} ${test.project}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    const test =
        visibleTests.find((test) => test.key === testKey) ?? visibleTests[0];
    const diagnostics = test?.diagnostics;
    const events =
        channel === "console" ? diagnostics?.console : diagnostics?.network;
    const text = !test
        ? tests.length
            ? "No tests match this search."
            : "No test report available for this run."
        : channel === "output"
          ? [
                `${result(test)}  ${test.title}`,
                `Expected status: ${test.expectedStatus} · ${test.duration}ms`,
                "",
                ...test.attempts.flatMap((attempt) => [
                    `── Attempt ${attempt.retry + 1} · ${attempt.status} · ${attempt.duration}ms ──`,
                    attempt.errors.join("\n") ||
                        (attempt.status === "passed"
                            ? "All assertions passed."
                            : "No error output recorded."),
                    "",
                ]),
                ...(!test.attempts.length ? ["No attempts recorded."] : []),
            ].join("\n")
          : events === undefined
            ? `${channel === "console" ? "Console" : "Network"} diagnostics were not recorded for this test.`
            : [
                  ...(events.length ? events : ["No events recorded."]),
                  ...(diagnostics?.warnings.length
                      ? ["", "Recording warnings:", ...diagnostics.warnings]
                      : []),
              ].join("\n");
    return (
        <section className="test-explorer" aria-label="Test explorer">
            <div className="explorer-context">
                <strong>Test explorer</strong>
                <span>
                    {run
                        ? `${run.phase} #${run.id} · ${run.status} · ${run.report?.outcome ?? "No report"}`
                        : "No runs yet"}
                </span>
                <span>
                    {tests.length} {tests.length === 1 ? "test" : "tests"}
                </span>
            </div>
            <div className="explorer-layout">
                <div className="explorer-sidebar">
                    <label>
                        Find a test
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Test, file, or project"
                        />
                    </label>
                    <div
                        className="explorer-test-list"
                        role="group"
                        aria-label="Tests"
                    >
                        {!visibleTests.length && (
                            <p>
                                {tests.length
                                    ? "No tests match this search."
                                    : "No tests recorded."}
                            </p>
                        )}
                        {visibleTests.map((item) => (
                            <button
                                type="button"
                                key={item.key}
                                aria-pressed={
                                    !history && test?.key === item.key
                                }
                                onClick={() => {
                                    setTestKey(item.key);
                                    setHistory(false);
                                }}
                            >
                                <span>
                                    <span
                                        className={`test-outcome outcome-${item.outcome}`}
                                    >
                                        {result(item)}
                                    </span>{" "}
                                    {item.title}
                                    <small>
                                        {item.file ?? ""}
                                        {item.file ? " · " : ""}
                                        {item.project || "Default project"}
                                    </small>
                                </span>
                                <small>{item.duration}ms</small>
                            </button>
                        ))}
                    </div>
                    <button
                        className="explorer-history"
                        type="button"
                        aria-pressed={history}
                        onClick={() => setHistory(true)}
                    >
                        Run history · {runs.length}
                    </button>
                </div>
                <div className="explorer-inspector">
                    {history ? (
                        <section aria-label="Run history">
                            <div className="explorer-inspector-heading">
                                <h3>Run history</h3>
                                <p>
                                    Select a run to inspect its tests and
                                    diagnostics.
                                </p>
                            </div>
                            <div className="explorer-runs">
                                {[...runs].reverse().map((item) => (
                                    <button
                                        type="button"
                                        key={item.id}
                                        onClick={() => {
                                            setRunId(item.id);
                                            setTestKey(undefined);
                                            setQuery("");
                                            setHistory(false);
                                        }}
                                    >
                                        <strong>
                                            #{item.id} · {item.phase}
                                        </strong>
                                        <span>
                                            {item.status} ·{" "}
                                            {item.report?.outcome ??
                                                "No report"}
                                        </span>
                                        <small>
                                            {item.created_at}
                                            {item.id === run?.id
                                                ? " · Selected"
                                                : ""}
                                        </small>
                                    </button>
                                ))}
                                {!runs.length && <p>No runs yet.</p>}
                            </div>
                        </section>
                    ) : (
                        <>
                            <div className="explorer-inspector-heading">
                                <h3>
                                    {test?.title ??
                                        (tests.length
                                            ? "No matching tests"
                                            : "Run output")}
                                </h3>
                                <p>
                                    {test
                                        ? `${test.file ?? "Source location not recorded"} · ${test.project || "Default project"}`
                                        : tests.length
                                          ? "Try another search to inspect a test."
                                          : "Waiting for test evidence"}
                                </p>
                            </div>
                            <div
                                className="explorer-channels"
                                role="group"
                                aria-label="Test output channels"
                            >
                                {["output", "console", "network"].map(
                                    (value) => (
                                        <button
                                            type="button"
                                            key={value}
                                            aria-pressed={channel === value}
                                            onClick={() => setChannel(value)}
                                        >
                                            {value[0].toUpperCase() +
                                                value.slice(1)}
                                        </button>
                                    ),
                                )}
                            </div>
                            <div className="explorer-output" aria-live="polite">
                                {(run?.error ||
                                    !!run?.report?.errors?.length) && (
                                    <pre className="explorer-run-error">
                                        {plainOutput(
                                            [
                                                "RUNNER ERRORS",
                                                run?.error,
                                                ...(run?.report?.errors ?? []),
                                            ]
                                                .filter(Boolean)
                                                .join("\n"),
                                        )}
                                    </pre>
                                )}
                                <pre aria-label="Selected test output">
                                    {plainOutput(text)}
                                </pre>
                            </div>
                            {!!test?.attachments.length && (
                                <div className="explorer-artifacts">
                                    {test.attachments.map((attachment) => (
                                        <a
                                            key={attachment.key}
                                            href={run!.artifact_base?.replace("__FILE__", attachment.file) ?? `/suite-runs/${run!.id}/artifacts/${attachment.file}`}
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            {attachment.name}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            <div className="explorer-breadcrumb">
                {run ? `${run.phase} #${run.id}` : "No run"} /{" "}
                {history
                    ? "Run history"
                    : `${test?.project || "Default project"} / ${test?.title ?? "No test selected"} / ${channel}`}
            </div>
        </section>
    );
}
