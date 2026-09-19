import { useState } from "react";
import { Form } from "./forms";
import { SuiteVideos } from "./SuiteVideos";
import type {
    Payload,
    TestSuite,
    SuiteRun,
    SuiteAttachment,
    SuiteCase,
} from "./types";
const imageCases = (run?: SuiteRun) =>
    run?.report?.tests.flatMap((test) =>
        test.attachments
            .filter((a) => a.contentType === "image/png")
            .map((attachment) => ({ test, attachment })),
    ) ?? [];
const url = (run: SuiteRun, a: SuiteAttachment) =>
    `/suite-runs/${run.id}/artifacts/${a.file}`;
function Results({ run }: { run?: SuiteRun }) {
    return (
        <div>
            {!run ? (
                <p>No run yet.</p>
            ) : (
                <>
                    <p>
                        <strong>
                            {run.status === "complete"
                                ? run.report?.outcome
                                : run.status}
                        </strong>{" "}
                        · Run #{run.id} ·{" "}
                        {new Date(run.created_at).toLocaleString()}
                    </p>
                    {run.error && <p role="alert">{run.error}</p>}
                    {run.report?.tests.map((test) => (
                        <details key={test.key}>
                            <summary>
                                {test.project} · {test.title} — {test.outcome} (
                                {test.duration} ms)
                            </summary>
                            <p>
                                Expected status: {test.expectedStatus}.
                                Attempts: {test.attempts.length}
                            </p>
                            {test.attempts.map((attempt, i) => (
                                <pre key={i}>
                                    Attempt {i + 1}: {attempt.status}
                                    {"\n"}
                                    {attempt.errors.join("\n")}
                                </pre>
                            ))}
                            <div className="links">
                                {test.attachments.map((a) => (
                                    <a
                                        key={a.key}
                                        href={url(run, a)}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        {a.name}
                                    </a>
                                ))}
                            </div>
                        </details>
                    ))}
                    {run.report && (
                        <details>
                            <summary>Run source and diagnostics</summary>
                            <pre>
                                {JSON.stringify(
                                    {
                                        before: run.report.sourceBefore,
                                        after: run.report.sourceAfter,
                                        errors: run.report.errors,
                                    },
                                    null,
                                    2,
                                )}
                            </pre>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}
function Screenshot({
    label,
    run,
    entry,
}: {
    label: string;
    run?: SuiteRun;
    entry?: { test: SuiteCase; attachment: SuiteAttachment };
}) {
    return (
        <article className="capture-panel">
            <div className="panel-heading">
                <strong>{label}</strong>
                <small>{entry?.test.outcome ?? "No matching screenshot"}</small>
            </div>
            {entry && run ? (
                <>
                    <div className="image-scroll">
                        <img
                            src={url(run, entry.attachment)}
                            alt={`${label} suite: ${entry.attachment.name}`}
                        />
                    </div>
                    <div className="links">
                        <a
                            href={url(run, entry.attachment)}
                            target="_blank"
                            rel="noopener"
                        >
                            Open full screenshot
                        </a>
                    </div>
                </>
            ) : (
                <div className="empty">
                    <p>
                        This run has no screenshot with this test, project, and
                        attachment name.
                    </p>
                </div>
            )}
        </article>
    );
}
function SuiteCard({ suite, csrf }: { suite: TestSuite; csrf: string }) {
    const before = suite.runs.find(
        (r) => r.phase === "before" && r.status === "complete",
    );
    const afterRuns = suite.runs.filter((r) => r.phase === "after");
    const [version, setVersion] = useState(""),
        [key, setKey] = useState(""),
        [overlay, setOverlay] = useState(false),
        [opacity, setOpacity] = useState(50);
    const after =
        afterRuns.find((r) => String(r.id) === version) ?? afterRuns.at(-1);
    const busy = suite.runs.some((r) =>
        ["queued", "running"].includes(r.status),
    );
    const left = imageCases(before),
        right = imageCases(after);
    const choices = [
        ...new Map(
            [...left, ...right].map((e) => [e.attachment.key, e]),
        ).values(),
    ];
    const selected = choices.some((e) => e.attachment.key === key)
        ? key
        : choices[0]?.attachment.key;
    const a = left.find((e) => e.attachment.key === selected),
        b = right.find((e) => e.attachment.key === selected);
    return (
        <section className="card evidence" aria-label={`Suite ${suite.name}`}>
            <div className="heading">
                <div>
                    <h3>{suite.name}</h3>
                    <code>{suite.config}</code>
                    {suite.grep && <p>Title filter: {suite.grep}</p>}
                </div>
                <div className="actions">
                    {["before", "after"].map((phase) => (
                        <Form
                            key={phase}
                            action={`/suites/${suite.id}/runs`}
                            csrf={csrf}
                        >
                            <input type="hidden" name="phase" value={phase} />
                            <button
                                className={phase === "after" ? "primary" : ""}
                                disabled={
                                    busy ||
                                    (phase === "before" ? !!before : !before)
                                }
                            >
                                {phase === "before" && before
                                    ? "Suite baseline locked"
                                    : `Run suite ${phase}`}
                            </button>
                        </Form>
                    ))}
                </div>
            </div>
            <p>
                Each run executes your current working tree locally using this
                config. Its own browser projects, auth fixtures, and web server
                settings apply. Test failures are saved as evidence; completed
                before runs are locked.
            </p>
            {busy && <p role="status">Suite queued or running…</p>}
            {suite.runs.at(-1)?.status === "failed" && (
                <p role="alert">{suite.runs.at(-1)?.error}</p>
            )}
            <SuiteVideos before={before} after={after} name={suite.name} />
            <div className="filters">
                {afterRuns.length > 0 && (
                    <label>
                        Suite after version
                        <select
                            aria-label={`After version for ${suite.name}`}
                            value={after?.id ?? ""}
                            onChange={(e) => setVersion(e.target.value)}
                        >
                            {afterRuns.map((r, i) => (
                                <option key={r.id} value={r.id}>
                                    #{i + 1} · {r.status} · {r.report?.outcome}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {choices.length > 0 && (
                    <label>
                        Suite screenshot
                        <select
                            aria-label={`Screenshot for ${suite.name}`}
                            value={selected}
                            onChange={(e) => setKey(e.target.value)}
                        >
                            {choices.map((e) => (
                                <option
                                    key={e.attachment.key}
                                    value={e.attachment.key}
                                >
                                    {e.test.project} · {e.test.title} ·{" "}
                                    {e.attachment.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <button
                    type="button"
                    disabled={!a || !b}
                    onClick={() => setOverlay(!overlay)}
                >
                    Suite overlay
                </button>
            </div>
            {choices.length === 0 ? (
                <p>
                    No PNG attachments yet. Use testInfo.attach with a named
                    page or component screenshot; see the example below.
                </p>
            ) : (
                <>
                    <div className="comparison" hidden={overlay && !!a && !!b}>
                        <Screenshot label="Before" run={before} entry={a} />
                        <Screenshot label="After" run={after} entry={b} />
                    </div>
                    {overlay && a && b && before && after && (
                        <div>
                            <label className="blend">
                                Before
                                <input
                                    type="range"
                                    aria-label="Suite after image opacity"
                                    min="0"
                                    max="100"
                                    value={opacity}
                                    onChange={(e) =>
                                        setOpacity(Number(e.target.value))
                                    }
                                />
                                After
                            </label>
                            <div className="overlay-scroll">
                                <div className="overlay-images">
                                    <img
                                        src={url(before, a.attachment)}
                                        alt="Suite baseline overlay"
                                    />
                                    <img
                                        src={url(after, b.attachment)}
                                        alt="Suite after overlay"
                                        style={{ opacity: opacity / 100 }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            <div className="comparison">
                <section>
                    <h4>Before test results</h4>
                    <Results
                        run={
                            before ??
                            suite.runs.find((r) => r.phase === "before")
                        }
                    />
                </section>
                <section>
                    <h4>After test results</h4>
                    <Results run={after} />
                </section>
            </div>
            <details>
                <summary>All suite attempts ({suite.runs.length})</summary>
                {suite.runs.map((run) => (
                    <Results key={run.id} run={run} />
                ))}
            </details>
        </section>
    );
}
export function SuiteComparisons({ data }: { data: Payload }) {
    const session = data.props.session!;
    return (
        <section>
            <h2>Playwright suite comparisons</h2>
            <p>
                Add a suite, run it before editing your feature, then run it
                after each change. Named screenshots are paired by test, browser
                project, and attachment name. New or missing screenshots are
                shown on only their available side.
            </p>
            {session.suites.map((suite) => (
                <SuiteCard key={suite.id} suite={suite} csrf={data.csrf} />
            ))}
            <details className="card evidence">
                <summary>Add a Playwright suite</summary>
                <Form
                    action={`/sessions/${session.id}/suites`}
                    csrf={data.csrf}
                >
                    <label>
                        Suite name
                        <input name="name" required maxLength={120} />
                    </label>
                    <label>
                        Suite config path
                        <input
                            name="config"
                            required
                            defaultValue={
                                session.environment.project.playwright_config ??
                                ""
                            }
                            placeholder="frontend/playwright.config.ts"
                        />
                    </label>
                    <label>
                        Test title filter (optional regex)
                        <input
                            name="grep"
                            maxLength={200}
                            placeholder="Portfolio"
                        />
                    </label>
                    <p>
                        Config paths are relative to your connected repository.
                        Tests use its installed Playwright package. Suite runs
                        currently execute locally, including when page captures
                        use Docker.
                    </p>
                    <button className="primary">Add suite</button>
                </Form>
            </details>
            <details className="card evidence">
                <summary>
                    How to add component screenshots to your tests
                </summary>
                <p>
                    Use the same attachment name before and after. Attach
                    different names for multiple steps. Each run has a
                    three-minute suite timeout.
                </p>
                <pre>{`test('my feature', async ({ page }, testInfo) => {
  await page.goto('/my-feature');
  await page.getByRole('button', { name: 'Open feature' }).click();
  const component = page.getByRole('dialog');
  await expect(component).toBeVisible();
  await testInfo.attach('feature-open', {
    body: await component.screenshot(),
    contentType: 'image/png',
  });
});`}</pre>
            </details>
        </section>
    );
}
