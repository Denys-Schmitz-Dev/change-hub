import { useEffect, useState } from "react";
import type { Payload, Frame, Run } from "./types";
import { Form } from "./forms";
import { SuiteComparisons } from "./SuiteComparisons";
const artifact = (frame: Frame | null | undefined) =>
    frame?.artifacts.find((a) => a.name === "page.png");
const date = (value?: string) =>
    value ? new Date(value).toLocaleString() : "Not captured";
function Panel({
    label,
    frame,
    run,
    view,
}: {
    label: string;
    frame?: Frame | null;
    run?: Run | null;
    view: string;
}) {
    const image = artifact(frame);
    return (
        <article className="capture-panel">
            <div className="panel-heading">
                <strong>
                    {label}
                    {label === "Before" && run ? " · LOCKED" : ""}
                </strong>
                <small>{date(run?.created_at)}</small>
            </div>
            {image ? (
                <>
                    <div
                        className={`image-scroll ${view.startsWith("mobile") ? "mobile" : ""}`}
                    >
                        <img
                            src={`/artifacts/${image.id}`}
                            alt={`${label}: ${view}`}
                        />
                    </div>
                    <div className="links">
                        {frame?.artifacts.map((a) => (
                            <a
                                key={a.id}
                                href={`/artifacts/${a.id}`}
                                target="_blank"
                                rel="noopener"
                            >
                                {a.name}
                            </a>
                        ))}
                    </div>
                </>
            ) : (
                <div className="empty">
                    <h2>
                        {label === "Before"
                            ? "Save your starting point"
                            : "Your next state goes here"}
                    </h2>
                    <p>
                        {frame?.error ??
                            "Capture your running environment to save this state."}
                    </p>
                </div>
            )}
        </article>
    );
}
export function Comparison({ data }: { data: Payload }) {
    const {
        session,
        before,
        after,
        afterRuns = [],
        keys = [],
        key = "",
        left,
        right,
        active,
        changes = {},
    } = data.props;
    const [overlay, setOverlay] = useState(false),
        [opacity, setOpacity] = useState(50);
    useEffect(() => {
        if (!active) return;
        const timer = setTimeout(() => location.reload(), 2500);
        return () => clearTimeout(timer);
    }, [active]);
    if (!session) return null;
    const leftImage = artifact(left),
        rightImage = artifact(right),
        last = session.runs.at(-1);
    return (
        <>
            <div className="heading">
                <div>
                    <span className="eyebrow">
                        {session.environment.project.name} /{" "}
                        {session.environment.name}
                    </span>
                    <h1>{session.title}</h1>
                    <p>
                        {session.profile.baseURL}
                        {session.profile.path} · {keys.length} views ·{" "}
                        {session.profile.adapter === "resume"
                            ? "Simulated visitor states"
                            : "Real page state"}
                    </p>
                </div>
                <div className="actions">
                    {["before", "after"].map((phase) => (
                        <Form
                            key={phase}
                            action={`/sessions/${session.id}/captures`}
                            csrf={data.csrf}
                        >
                            <input type="hidden" name="phase" value={phase} />
                            <button
                                className={phase === "after" ? "primary" : ""}
                                disabled={
                                    active ||
                                    (phase === "before" ? !!before : !before)
                                }
                            >
                                {phase === "before" && before
                                    ? "✓ Baseline locked"
                                    : `Capture ${phase}`}
                            </button>
                        </Form>
                    ))}
                </div>
            </div>
            <div className="steps">
                <div>
                    <b>1</b>
                    <strong>Save before</strong>
                    <small>
                        {before
                            ? "Baseline locked"
                            : "Capture your starting point"}
                    </small>
                </div>
                <div>
                    <b>2</b>
                    <strong>Make your change</strong>
                    <small>Use your editor and existing environment</small>
                </div>
                <div>
                    <b>3</b>
                    <strong>Compare after</strong>
                    <small>{after?.status ?? "Capture when ready"}</small>
                </div>
            </div>
            {active && (
                <div role="status" className="notice" data-refresh>
                    Capture queued or running. This page refreshes while
                    evidence is saved.
                </div>
            )}
            {last?.status === "failed" && (
                <div role="alert" className="notice error">
                    {last.error} The failed attempt is retained; you can retry.
                </div>
            )}
            <form className="filters" method="get">
                <label>
                    View
                    <select aria-label="View" name="view" defaultValue={key}>
                        {keys.map((k) => (
                            <option key={k}>{k}</option>
                        ))}
                    </select>
                </label>
                {afterRuns.length > 0 && (
                    <label>
                        After version
                        <select
                            aria-label="After version"
                            name="run"
                            defaultValue={after?.id}
                        >
                            {afterRuns.map((r, i) => (
                                <option key={r.id} value={r.id}>
                                    #{i + 1} · {date(r.created_at)} · {r.status}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <button>Show view</button>
                <button
                    type="button"
                    disabled={
                        !leftImage ||
                        !rightImage ||
                        after?.status !== "complete"
                    }
                    onClick={() => setOverlay(!overlay)}
                >
                    Overlay
                </button>
            </form>
            <div className="comparison" hidden={overlay}>
                <Panel label="Before" frame={left} run={before} view={key} />
                <Panel label="After" frame={right} run={after} view={key} />
            </div>
            {overlay && leftImage && rightImage && (
                <section>
                    <label className="blend">
                        Before
                        <input
                            type="range"
                            min="0"
                            max="100"
                            aria-label="After image opacity"
                            value={opacity}
                            onChange={(e) => setOpacity(Number(e.target.value))}
                        />
                        After
                    </label>
                    <div className="overlay-scroll">
                        <div
                            className={`overlay-images ${key.startsWith("mobile") ? "mobile" : ""}`}
                        >
                            <img
                                src={`/artifacts/${leftImage.id}`}
                                alt="Baseline overlay"
                            />
                            <img
                                id="after-image"
                                src={`/artifacts/${rightImage.id}`}
                                alt="After overlay"
                                style={{ opacity: opacity / 100 }}
                            />
                        </div>
                    </div>
                </section>
            )}
            <section className="card evidence">
                <h2>What changed in this view</h2>
                {Object.keys(changes).length > 0 ? (
                    <>
                        <p>
                            {leftImage?.sha256 === rightImage?.sha256
                                ? "Screenshot files are identical."
                                : "Screenshot files differ; review the images to assess the visual change."}{" "}
                            This is recorded evidence, not a pass/fail verdict.
                        </p>
                        {Object.entries(changes).map(([category, diff]) => (
                            <details key={category}>
                                <summary>
                                    {category[0].toUpperCase() +
                                        category.slice(1)}{" "}
                                    · +{diff.added.length} / −
                                    {diff.removed.length}
                                </summary>
                                <pre>{JSON.stringify(diff, null, 2)}</pre>
                            </details>
                        ))}
                    </>
                ) : (
                    <p>
                        Once both captures are available, compare visible text,
                        headings, controls, and links here.
                    </p>
                )}
                {[left, right].map(
                    (f, i) =>
                        f && (
                            <details key={i}>
                                <summary>
                                    {i === 0 ? "Before" : "After"} · Console &
                                    network
                                </summary>
                                <pre>{JSON.stringify(f.events, null, 2)}</pre>
                            </details>
                        ),
                )}
            </section>
            <SuiteComparisons data={data} />
            <section className="card evidence">
                <h2>Capture history</h2>
                <p>
                    Every after capture is a separate version. Baselines remain
                    fixed.
                </p>
                {session.runs.map((r) => (
                    <details key={r.id}>
                        <summary>
                            {r.phase} #{r.id} · {r.status} ·{" "}
                            {date(r.created_at)}
                        </summary>
                        {r.error && <p>{r.error}</p>}
                        <pre>{JSON.stringify(r.metadata, null, 2)}</pre>
                    </details>
                ))}
            </section>
        </>
    );
}
