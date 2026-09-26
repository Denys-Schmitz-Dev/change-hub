import { useState } from "react";
import { changeReview } from "./change-review";
import { TestRows } from "./TestResults";
import { Form } from "./forms";
import type { ReviewApproval, SuiteRun } from "./types";

export function ChangeReview({
    before,
    after,
    sessionId,
    csrf,
    approvals,
    approvalRunIds,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
    sessionId: number;
    csrf: string;
    approvals: ReviewApproval[];
    approvalRunIds?: number[];
}) {
    const [query, setQuery] = useState(""),
        [gapsOnly, setGapsOnly] = useState(false);
    const review = changeReview(before, after);
    const approvalFor = (file: string) =>
        approvals.find(
            (approval) =>
                (approvalRunIds ?? (after ? [after.id] : [])).includes(Number(approval.run_id)) && approval.file === file,
        );
    const unresolved = review.areas.filter(
        (area) => area.gaps.length && !approvalFor(area.file),
    ).length;
    const approved = review.areas.filter((area) => approvalFor(area.file)).length;
    const areas = review.areas.filter(
        (area) =>
            (!gapsOnly || (area.gaps.length && !approvalFor(area.file))) &&
            `${area.file} ${area.contracts.map((change) => (change.after ?? change.before)!.label).join(" ")}`
                .toLowerCase()
                .includes(query.toLowerCase()),
    );
    return (
        <div className="change-review" role="region" aria-label="Change review">
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
                    <dt>Unresolved evidence gaps</dt>
                    <dd>{review.comparable ? unresolved : "—"}</dd>
                </div>
                <div>
                    <dt>Approved exceptions</dt>
                    <dd>{review.comparable ? approved : "—"}</dd>
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
                            Unresolved gaps only
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
                    {areas.map((area) => {
                        const approval = approvalFor(area.file);
                        return (
                        <div className="review-area-card" key={area.file}>
                        <details className="review-area">
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
                                    className={`review-status ${approval ? "approved" : area.gaps.length ? "attention" : "available"}`}
                                >
                                    {approval
                                        ? "Approved exception"
                                        : area.gaps.length
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
                                    {approval ? (
                                        <div className="review-approval">
                                            <p><strong>Gap approved</strong> · {new Date(approval.approved_at).toLocaleString()}</p>
                                        </div>
                                    ) : null}
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
                        {area.gaps.length && after && (
                            <div className="review-approval-actions">
                                {approval ? (
                                    <Form action={`/sessions/${sessionId}/review-approvals`} csrf={csrf}>
                                        <input type="hidden" name="_method" value="DELETE" />
                                        <input type="hidden" name="run_id" value={approval.run_id} />
                                        <input type="hidden" name="file" value={approval.file} />
                                        <button className="reject" aria-label={`Revoke approval for ${area.file}`} title="Revoke approval">×</button>
                                    </Form>
                                ) : (
                                    <Form action={`/sessions/${sessionId}/review-approvals`} csrf={csrf}>
                                        <input type="hidden" name="run_id" value={after.id} />
                                        <input type="hidden" name="file" value={area.file} />
                                        <input type="hidden" name="reason" value="manually_verified" />
                                        <button className="approve" aria-label={`Approve gap for ${area.file}`} title="Approve gap">✓</button>
                                    </Form>
                                )}
                            </div>
                        )}
                        </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
