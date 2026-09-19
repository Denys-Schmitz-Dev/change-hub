import { useRef, useState } from "react";
import type { SuiteRun, SuiteAttachment, SuiteCase } from "./types";
type Entry = { test: SuiteCase; attachment: SuiteAttachment };
const videos = (run?: SuiteRun): Entry[] =>
    run?.report?.tests.flatMap((test) =>
        test.attachments
            .filter((a) => a.contentType === "video/webm")
            .map((attachment) => ({ test, attachment })),
    ) ?? [];
const source = (run: SuiteRun, entry: Entry) =>
    `/suite-runs/${run.id}/artifacts/${entry.attachment.file}`;
function Players({
    before,
    after,
    left,
    right,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
    left?: Entry;
    right?: Entry;
}) {
    const a = useRef<HTMLVideoElement>(null),
        b = useRef<HTMLVideoElement>(null);
    const [speed, setSpeed] = useState(1),
        [error, setError] = useState("");
    const both = !!left && !!right;
    async function playBoth() {
        setError("");
        const players = [a.current, b.current].filter(
            (v): v is HTMLVideoElement => v !== null,
        );
        try {
            for (const player of players) {
                player.currentTime = 0;
                player.playbackRate = speed;
            }
            await Promise.all(players.map((player) => player.play()));
        } catch {
            setError(
                "Playback could not start. Use the individual video controls to retry.",
            );
        }
    }
    return (
        <>
            <div className="filters">
                <button
                    type="button"
                    disabled={!both}
                    onClick={() => void playBoth()}
                >
                    Play both from start
                </button>
                <button
                    type="button"
                    disabled={!both}
                    onClick={() => {
                        a.current?.pause();
                        b.current?.pause();
                    }}
                >
                    Pause both
                </button>
                <label>
                    Playback speed
                    <select
                        aria-label="Interaction playback speed"
                        value={speed}
                        onChange={(e) => {
                            const next = Number(e.target.value);
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
            </div>
            {error && <p role="alert">{error}</p>}
            <div className="comparison">
                {[
                    { label: "Before", run: before, entry: left, ref: a },
                    { label: "After", run: after, entry: right, ref: b },
                ].map(({ label, run, entry, ref }) => (
                    <article className="capture-panel" key={label}>
                        <div className="panel-heading">
                            <strong>{label} interaction</strong>
                            <small>{entry?.test.project}</small>
                        </div>
                        {entry && run ? (
                            <>
                                <video
                                    ref={ref}
                                    controls
                                    playsInline
                                    muted
                                    preload="metadata"
                                    aria-label={`${label} interaction video`}
                                    src={source(run, entry)}
                                    style={{
                                        width: "100%",
                                        maxHeight: 640,
                                        background: "#111",
                                    }}
                                    onError={() =>
                                        setError(
                                            "A recording could not be loaded. Try opening its video file directly.",
                                        )
                                    }
                                />
                                <div className="links">
                                    <a
                                        href={source(run, entry)}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        Open {label.toLowerCase()} video
                                    </a>
                                </div>
                            </>
                        ) : (
                            <div className="empty">
                                <p>
                                    No matching recording in this run. Older
                                    runs without video cannot be reconstructed;
                                    record a new suite baseline for a full video
                                    comparison.
                                </p>
                            </div>
                        )}
                    </article>
                ))}
            </div>
        </>
    );
}
export function SuiteVideos({
    before,
    after,
    name,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
    name: string;
}) {
    const left = videos(before),
        right = videos(after);
    const choices = [
        ...new Map(
            [...left, ...right].map((entry) => [entry.attachment.key, entry]),
        ).values(),
    ];
    const [key, setKey] = useState("");
    const selected = choices.some((entry) => entry.attachment.key === key)
        ? key
        : choices[0]?.attachment.key;
    return (
        <section aria-label={`Interaction videos for ${name}`}>
            <h4>Interaction videos</h4>
            {choices.length === 0 ? (
                <p>
                    No recordings in these runs. Set{" "}
                    <code>
                        use: {"{"} video: 'on' {"}"}
                    </code>{" "}
                    in your Playwright config, then run the suite. Videos show
                    the browser interaction at test speed.
                </p>
            ) : (
                <>
                    <label>
                        Recorded interaction
                        <select
                            aria-label={`Video for ${name}`}
                            value={selected}
                            onChange={(e) => setKey(e.target.value)}
                        >
                            {choices.map((entry) => (
                                <option
                                    key={entry.attachment.key}
                                    value={entry.attachment.key}
                                >
                                    {entry.test.project} · {entry.test.title} ·{" "}
                                    {entry.attachment.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <p>
                        Watch or scrub each recording, or start both together.
                        Playback aligns elapsed time, not individual test
                        actions. Slow it down to inspect quick transitions.
                    </p>
                    <Players
                        key={`${before?.id}-${after?.id}-${selected}`}
                        before={before}
                        after={after}
                        left={left.find(
                            (entry) => entry.attachment.key === selected,
                        )}
                        right={right.find(
                            (entry) => entry.attachment.key === selected,
                        )}
                    />
                </>
            )}
        </section>
    );
}
