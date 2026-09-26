import { useEffect, useRef, useState } from "react";
import { FullscreenComparison } from "./FullscreenComparison";
import type { SuiteRun, SuiteAttachment, SuiteCase } from "./types";
type Entry = { test: SuiteCase; attachment: SuiteAttachment; run: SuiteRun };
const videos = (run?: SuiteRun): Entry[] =>
    run?.report?.tests.flatMap((test) =>
        test.attachments
            .filter((a) => a.contentType === "video/webm")
            .map((attachment) => ({ test, attachment, run: run! })),
    ) ?? [];
const source = (run: SuiteRun, entry: Entry) =>
    run.artifact_base?.replace("__FILE__", entry.attachment.file) ??
    `/suite-runs/${run.id}/artifacts/${entry.attachment.file}`;
const poster = (run: SuiteRun, entry: Entry) => {
    const screenshots = entry.test.attachments.filter(
        (attachment) => attachment.contentType === "image/png",
    );
    const attachment =
        screenshots.find((attachment) => attachment.name === "page") ??
        screenshots[0];
    return attachment
        ? (run.artifact_base?.replace("__FILE__", attachment.file) ??
              `/suite-runs/${run.id}/artifacts/${attachment.file}`)
        : undefined;
};
function Players({
    left,
    right,
    active,
    reference,
}: {
    left?: Entry;
    right?: Entry;
    active: boolean;
    reference?: string;
}) {
    const a = useRef<HTMLVideoElement>(null),
        b = useRef<HTMLVideoElement>(null);
    const [speed, setSpeed] = useState(1),
        [error, setError] = useState("");
    const [view, setView] = useState<"both" | "before" | "after">(
        left && right ? "both" : left ? "before" : "after",
    );
    const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
    const pause = () => {
        a.current?.pause();
        b.current?.pause();
    };
    useEffect(() => {
        if (!active) pause();
    }, [active]);
    async function play(target = view) {
        setError("");
        pause();
        const players = [
            target !== "after" ? a.current : null,
            target !== "before" ? b.current : null,
        ].filter((video): video is HTMLVideoElement => !!video);
        try {
            for (const player of players) {
                player.currentTime = 0;
                player.playbackRate = speed;
            }
            await Promise.all(players.map((player) => player.play()));
        } catch {
            pause();
            setError(
                "Playback could not start. Use the video controls to retry.",
            );
        }
    }
    const playable =
        view === "both"
            ? !!left || !!right
            : view === "before"
              ? !!left
              : !!right;
    return (
        <FullscreenComparison
            enabled={playable}
            active={active}
            onPlay={() => play()}
            controls={
                <>
                    <button
                        type="button"
                        disabled={!left || !right}
                        onClick={() => {
                            setView("both");
                            void play("both");
                        }}
                    >
                        Play both
                    </button>
                    {view !== "both" && (
                        <button
                            type="button"
                            disabled={!playable}
                            onClick={() => void play()}
                        >
                            Play {view}
                        </button>
                    )}
                    <button type="button" disabled={!playable} onClick={pause}>
                        Pause
                    </button>
                    <label>
                        View
                        <select
                            aria-label="Video view"
                            value={view}
                            onChange={(event) => {
                                pause();
                                setView(event.target.value as typeof view);
                            }}
                        >
                            <option value="both">Show both</option>
                            <option value="before">Show before</option>
                            <option value="after">Show after</option>
                        </select>
                    </label>
                    <label>
                        Speed
                        <select
                            aria-label="Interaction playback speed"
                            value={speed}
                            onChange={(event) => {
                                const next = Number(event.target.value);
                                setSpeed(next);
                                if (a.current) a.current.playbackRate = next;
                                if (b.current) b.current.playbackRate = next;
                            }}
                        >
                            {[0.25, 0.5, 1, 2].map((rate) => (
                                <option key={rate} value={rate}>
                                    {rate}×
                                </option>
                            ))}
                        </select>
                    </label>
                </>
            }
        >
            {error && <p role="alert">{error}</p>}
            <div className="comparison viewer-videos" data-view={view}>
                {[
                    { label: "Before", entry: left, ref: a },
                    { label: "After", entry: right, ref: b },
                ].map(({ label, entry, ref }) => (
                    <article
                        className="capture-panel"
                        key={label}
                        hidden={view !== "both" && view !== label.toLowerCase()}
                    >
                        <div className="panel-heading">
                            <strong>{label}</strong>
                            {label === "Before" && reference && (
                                <small title={left?.test.title}>
                                    {reference}
                                </small>
                            )}
                            {entry && (
                                <a
                                    href={source(entry.run, entry)}
                                    target="_blank"
                                    rel="noopener"
                                    aria-label={`Open ${label.toLowerCase()} video`}
                                >
                                    Open ↗
                                </a>
                            )}
                        </div>
                        {entry ? (
                            <>
                                <video
                                    ref={ref}
                                    controls
                                    playsInline
                                    muted
                                    preload="metadata"
                                    aria-label={`${label} interaction video`}
                                    src={source(entry.run, entry)}
                                    poster={poster(entry.run, entry)}
                                    className="comparison-video"
                                    onLoadedData={() =>
                                        setLoadErrors((errors) => ({
                                            ...errors,
                                            [label]: "",
                                        }))
                                    }
                                    onError={() =>
                                        setLoadErrors((errors) => ({
                                            ...errors,
                                            [label]: `${label} recording could not load. Retry or open the original video.`,
                                        }))
                                    }
                                />
                                {loadErrors[label] && (
                                    <div className="video-error">
                                        <p role="alert">{loadErrors[label]}</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLoadErrors((errors) => ({
                                                    ...errors,
                                                    [label]: "",
                                                }));
                                                ref.current?.load();
                                            }}
                                        >
                                            Retry {label.toLowerCase()} video
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="empty">
                                <p>No {label.toLowerCase()} recording.</p>
                                {label === "Before" && (
                                    <p>
                                        This test has no matching recording or
                                        existing-component reference in the
                                        session baseline.
                                    </p>
                                )}
                            </div>
                        )}
                    </article>
                ))}
            </div>
        </FullscreenComparison>
    );
}

function baselineFor(
    entry: Entry,
    baseline: Entry[],
    config?: string,
): { entry?: Entry; reference?: string } {
    if (entry.run.phase === "before") return { entry };
    const exact = baseline.find(
        (item) =>
            item.attachment.key === entry.attachment.key &&
            (!config || !item.run.config || item.run.config === config),
    );
    if (exact) return { entry: exact };
    const files = entry.test.coveredFiles ?? [];
    const candidates = baseline.filter(
        (item) => item.test.project === entry.test.project,
    );
    const component = candidates.find((item) =>
        item.test.coveredFiles?.some((file) => files.includes(file)),
    );
    if (component) return { entry: component, reference: "Component baseline" };
    const existing = candidates.find((item) =>
        Object.values(item.run.report?.contracts?.categories ?? {})
            .flat()
            .some((contract) => files.includes(contract.file)),
    );
    return existing
        ? { entry: existing, reference: "Session baseline reference" }
        : {};
}

export function SuiteVideos({
    before,
    baselineRuns,
    config,
    after,
    name,
    selectedTests,
    active = true,
}: {
    before?: SuiteRun;
    baselineRuns?: SuiteRun[];
    config?: string;
    after?: SuiteRun;
    name: string;
    selectedTests?: string[] | null;
    active?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [selectedKey, setSelectedKey] = useState<string>();
    const baselineEntries = new Map<string, Entry>();
    for (const run of baselineRuns ?? (before ? [before] : [])) {
        for (const item of videos(run)) {
            const identity = `${run.config ?? ""}:${item.attachment.key}`;
            if (!baselineEntries.has(identity))
                baselineEntries.set(identity, item);
        }
    }
    const left = [...baselineEntries.values()],
        right = videos(after);
    const choices = [
        ...new Map(
            [
                ...left.filter(
                    (item) =>
                        !after ||
                        after.report?.tests.some(
                            (test) => test.key === item.test.key,
                        ),
                ),
                ...right,
            ].map((entry) => [entry.attachment.key, entry]),
        ).values(),
    ].filter(
        (entry) =>
            selectedTests == null || selectedTests.includes(entry.test.key),
    );
    const visible = choices.filter((entry) =>
        `${entry.test.title} ${entry.test.file ?? ""} ${entry.test.project} ${entry.attachment.name}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    const entry =
        visible.find((entry) => entry.attachment.key === selectedKey) ??
        visible[0];
    const selectedBaseline = entry ? baselineFor(entry, left, config) : {};
    return (
        <section
            className="test-explorer video-explorer"
            aria-label={`Interaction videos for ${name}`}
        >
            <div className="explorer-context">
                <strong>Video explorer</strong>
                <span>{name}</span>
                <span>
                    {choices.length}{" "}
                    {choices.length === 1 ? "recording" : "recordings"}
                </span>
            </div>
            {before?.capture_video === false && (
                <p>Video capture was off for this baseline.</p>
            )}
            {after?.capture_video === false && (
                <p>Video capture was off for this after run.</p>
            )}
            <div className="explorer-layout">
                <div className="explorer-sidebar">
                    <label>
                        Find a recording
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
                        aria-label="Recordings"
                    >
                        {visible.map((item) => (
                            <button
                                type="button"
                                key={item.attachment.key}
                                aria-pressed={
                                    entry?.attachment.key ===
                                    item.attachment.key
                                }
                                onClick={() =>
                                    setSelectedKey(item.attachment.key)
                                }
                            >
                                <span>
                                    {item.test.title}
                                    <small>
                                        {item.test.file ?? ""} ·{" "}
                                        {item.test.project || "Default"} ·{" "}
                                        {item.attachment.name}
                                    </small>
                                </span>
                                <small>
                                    {baselineFor(item, left, config).entry
                                        ? "Before"
                                        : ""}
                                    {baselineFor(item, left, config).entry &&
                                    right.some(
                                        (candidate) =>
                                            candidate.attachment.key ===
                                            item.attachment.key,
                                    )
                                        ? " + "
                                        : ""}
                                    {right.some(
                                        (candidate) =>
                                            candidate.attachment.key ===
                                            item.attachment.key,
                                    )
                                        ? "After"
                                        : ""}
                                </small>
                            </button>
                        ))}
                        {!visible.length && (
                            <p>
                                {choices.length
                                    ? "No recordings match this search."
                                    : selectedTests?.length === 0
                                      ? "No tests selected for video comparison."
                                      : "No recordings for the selected tests in these runs."}
                            </p>
                        )}
                    </div>
                </div>
                <div className="explorer-inspector">
                    {entry ? (
                        <section
                            className="video-pair"
                            aria-label={`${entry.test.project}: ${entry.test.title}: ${entry.attachment.name}`}
                        >
                            <Players
                                key={`${before?.id}-${after?.id}-${entry.attachment.key}`}
                                left={selectedBaseline.entry}
                                reference={selectedBaseline.reference}
                                right={right.find(
                                    (candidate) =>
                                        candidate.attachment.key ===
                                        entry.attachment.key,
                                )}
                                active={active}
                            />
                        </section>
                    ) : (
                        <div className="empty">
                            <p>
                                {choices.length
                                    ? "Try a different search to find a recording."
                                    : "Capture a run with selected tests to review their videos here."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
            <div className="explorer-breadcrumb">
                Before{" "}
                {selectedBaseline.entry
                    ? `#${selectedBaseline.entry.run.id}`
                    : "no matching recording"}{" "}
                / After {after ? `#${after.id}` : "not captured"} /{" "}
                {entry
                    ? "Session baseline → selected after run"
                    : "No recording selected"}
            </div>
        </section>
    );
}
