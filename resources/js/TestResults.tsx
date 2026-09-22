import type { SuiteCase, SuiteRun } from "./types";

export function TestRows({
    tests,
    run,
}: {
    tests: SuiteCase[];
    run?: SuiteRun;
}) {
    return (
        <div className="test-result-list">
            {tests.map((test) => (
                <div className="test-result-row" key={test.key}>
                    <span>
                        <strong>{test.title}</strong>
                        <small>{test.project || "Default project"}</small>
                    </span>
                    <span
                        className={`review-status ${test.outcome === "unexpected" || test.outcome === "flaky" ? "attention" : ""}`}
                    >
                        {test.outcome === "expected" &&
                        test.attempts.at(-1)?.status === "passed"
                            ? "Passed"
                            : test.outcome === "unexpected"
                              ? "Failed"
                              : test.outcome}
                    </span>
                    {run && (
                        <span className="test-artifact-links">
                            {test.attachments
                                .filter(
                                    (attachment) =>
                                        attachment.contentType !== "image/png",
                                )
                                .map((attachment) => (
                                    <a
                                        key={attachment.key}
                                        href={`/suite-runs/${run.id}/artifacts/${attachment.file}`}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        {attachment.contentType === "video/webm"
                                            ? "Video"
                                            : attachment.name}
                                    </a>
                                ))}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

export function FailureOutput({ run }: { run?: SuiteRun }) {
    const failures =
        run?.report?.tests.filter(
            (test) =>
                test.outcome === "unexpected" ||
                test.outcome === "flaky" ||
                test.attempts.some(
                    (attempt) =>
                        attempt.status !== "passed" &&
                        attempt.status !== "skipped",
                ),
        ) ?? [];
    if (!failures.length && !run?.report?.errors?.length) return null;
    return (
        <section className="failure-output" aria-label="Failure output">
            <h3>Failure output</h3>
            {run?.report?.errors?.map((error, index) => (
                <pre key={index}>{error}</pre>
            ))}
            {failures.map((test) => (
                <article key={test.key}>
                    <h4>
                        {test.title}{" "}
                        <span className="review-status attention">
                            {test.outcome === "flaky"
                                ? "Passed on retry"
                                : test.outcome === "expected"
                                  ? "Expected failure"
                                  : "Failed"}
                        </span>
                    </h4>
                    <small>{test.project || "Default project"}</small>
                    {test.attempts
                        .filter(
                            (attempt) =>
                                attempt.status !== "passed" &&
                                attempt.status !== "skipped",
                        )
                        .map((attempt, index) => (
                            <div key={index}>
                                <p>
                                    Attempt {attempt.retry + 1} ·{" "}
                                    {attempt.status}
                                </p>
                                <pre>
                                    {attempt.errors.join("\n") ||
                                        "No error output recorded."}
                                </pre>
                            </div>
                        ))}
                    {!test.attempts.some(
                        (attempt) =>
                            attempt.status !== "passed" &&
                            attempt.status !== "skipped",
                    ) && <p>No failed attempt output recorded.</p>}
                </article>
            ))}
        </section>
    );
}
