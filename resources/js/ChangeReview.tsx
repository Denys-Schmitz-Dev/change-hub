import { useState } from "react";
import { changeReview } from "./change-review";
import { TestRows } from "./TestResults";
import type { SuiteRun } from "./types";

export function ChangeReview({
    before,
    after,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
}) {
    const [query, setQuery] = useState(""),
        [gapsOnly, setGapsOnly] = useState(false);
    const review = changeReview(before, after);
    const areas = review.areas.filter(
        (area) =>
            (!gapsOnly || area.gaps.length) &&
            `${area.file} ${area.contracts.map((change) => (change.after ?? change.before)!.label).join(" ")}`
                .toLowerCase()
                .includes(query.toLowerCase()),
    );
    return (
        <section className="change-review" aria-label="Change review">
            <div className="review-intro">
                <span className="eyebrow">CHANGE → EVIDENCE → REVIEW</span>
                <h2>What changed. What needs a closer look.</h2>
                <p>
                    Review the selected suite and after version. Test
                    declarations connect files to evidence; they do not verify
                    every changed contract.
                </p>
            </div>
            <dl className="review-metrics">
                <div>
                    <dt>Changed contracts</dt>
                    <dd>{review.comparable ? review.changed : "—"}</dd>
                </div>
                <div>
                    <dt>Changed files</dt>
                    <dd>{review.comparable ? review.areas.length : "—"}</dd>
                </div>
                <div className="attention-metric">
                    <dt>Files with evidence gaps</dt>
                    <dd>{review.comparable ? review.needsAttention : "—"}</dd>
                </div>
                <div>
                    <dt>Human visual approval</dt>
                    <dd className="text-metric">Not recorded</dd>
                </div>
            </dl>
            {!review.comparable ? (
                <p className="notice">
                    Capture two completed runs with source snapshots to review
                    changes. Missing or incomplete runs cannot establish
                    verification. <a href="?tab=overview">Return to capture controls</a>
                </p>
            ) : (
                <>
                    {!!review.warnings.length && (
                        <p className="notice error">
                            Partial source inventory: {review.warnings.length}{" "}
                            warnings. Review source warnings in Contract diffs
                            before drawing conclusions.
                        </p>
                    )}
                    <div className="review-toolbar">
                        <label>
                            Find a changed area
                            <input
                                type="search"
                                placeholder="Search files or contracts…"
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </label>
                        <button
                            type="button"
                            aria-pressed={gapsOnly}
                            onClick={() => setGapsOnly(!gapsOnly)}
                        >
                            Evidence gaps only
                        </button>
                        <span>
                            {areas.length} of {review.areas.length} files
                        </span>
                    </div>
                    {!areas.length && (
                        <p className="review-empty">
                            {review.areas.length
                                ? "No changed areas match these filters."
                                : "No changes detected in scanned contracts. This is not a full repository coverage check."}
                        </p>
                    )}
                    {areas.map((area) => (
                        <details className="review-area" key={area.file}>
                            <summary>
                                <span className="area-title">
                                    <code>{area.file}</code>
                                    <small>
                                        {area.contracts.length} contract changes
                                        · {area.tests.length} declared test
                                        links
                                    </small>
                                </span>
                                <span
                                    className={`review-status ${area.gaps.length ? "attention" : "available"}`}
                                >
                                    {area.gaps.length
                                        ? "Evidence gaps"
                                        : "Evidence available"}
                                </span>
                            </summary>
                            <div className="area-body">
                                <div className="area-section">
                                    <h3>Detected changes</h3>
                                    {area.contracts.map((change) => (
                                        <p
                                            key={`${change.category}-${change.key}`}
                                        >
                                            <span
                                                className={`contract-status ${change.status.toLowerCase()}`}
                                            >
                                                {change.status}
                                            </span>
                                            {
                                                (change.after ?? change.before)!
                                                    .label
                                            }
                                            <small> · {change.category}</small>
                                        </p>
                                    ))}
                                </div>
                                <div className="area-section">
                                    <h3>Review gaps</h3>
                                    {area.gaps.length ? (
                                        <ul className="gap-list">
                                            {area.gaps.map((gap) => (
                                                <li key={gap}>{gap}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p>
                                            Linked tests have runtime and visual
                                            artifacts. Inspect the evidence
                                            before accepting this change.
                                        </p>
                                    )}
                                    <p>
                                        Human visual approval:{" "}
                                        <strong>not recorded</strong>. Viewing
                                        an artifact does not mark it approved.
                                    </p>
                                </div>
                                <div className="area-section">
                                    <h3>Declared tests & observed evidence</h3>
                                    {!area.tests.length && (
                                        <p>
                                            No after-run test declares coverage
                                            for this file.
                                        </p>
                                    )}
                                    <TestRows tests={area.tests} run={after} />
                                    {!!area.tests.length && (
                                        <p className="evidence-scope">
                                            Runtime diagnostics:{" "}
                                            {
                                                area.tests.filter(
                                                    (test) =>
                                                        !!test.diagnostics,
                                                ).length
                                            }
                                            /{area.tests.length} tests recorded.
                                            Inspect events in Test explorer;
                                            compare recordings in Videos.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </details>
                    ))}
                </>
            )}
        </section>
    );
}
