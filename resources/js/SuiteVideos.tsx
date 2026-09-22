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
const poster = (run: SuiteRun, entry: Entry) => {
    const screenshots = entry.test.attachments.filter(
        (attachment) => attachment.contentType === "image/png",
    );
    const attachment =
        screenshots.find((attachment) => attachment.name === "page") ??
        screenshots[0];
    return attachment
        ? `/suite-runs/${run.id}/artifacts/${attachment.file}`
        : undefined;
};
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
    const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
    const both = !!left && !!right;
    const playable = !!left || !!right;
    const playbackTarget = both ? "both" : left ? "before" : "after";
    async function playFromStart() {
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
            players.forEach((player) => player.pause());
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
                    disabled={!playable}
                    onClick={() => void playFromStart()}
                >
                    Play {playbackTarget} from start
                </button>
                <button
                    type="button"
                    disabled={!playable}
                    onClick={() => {
                        a.current?.pause();
                        b.current?.pause();
                    }}
                >
                    Pause {playbackTarget}
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
            <div className={`comparison ${!after ? "baseline-video" : ""}`}>
                {[
                    { label: "Before", run: before, entry: left, ref: a },
                    { label: "After", run: after, entry: right, ref: b },
                ]
                    .filter(({ label }) => label !== "After" || after)
                    .map(({ label, run, entry, ref }) => (
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
                                        poster={poster(run, entry)}
                                        className="comparison-video"
                                        onLoadedData={() =>
                                            setLoadErrors((errors) => ({
                                                ...errors,
                                                [label]: "",
                                            }))
                                        }
                                        onError={(event) => {
                                            const code =
                                                event.currentTarget.error?.code;
                                            const reason =
                                                code === 3 || code === 4
                                                    ? "The browser could not decode this WebM recording."
                                                    : "The recording could not be downloaded.";
                                            setLoadErrors((errors) => ({
                                                ...errors,
                                                [label]: `${label}: ${reason}`,
                                            }));
                                        }}
                                    />
                                    {loadErrors[label] && (
                                        <div className="video-error">
                                            <p role="alert">
                                                {loadErrors[label]}
                                            </p>
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
                                                Retry {label.toLowerCase()}{" "}
                                                video
                                            </button>
                                        </div>
                                    )}
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
                                    <p>No {label.toLowerCase()} recording.</p>
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
    selectedTests,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
    name: string;
    selectedTests?: string[] | null;
}) {
    const left = videos(before),
        right = videos(after);
    const choices = [
        ...new Map(
            [...left, ...right].map((entry) => [entry.attachment.key, entry]),
        ).values(),
    ].filter(entry => selectedTests == null || selectedTests.includes(entry.test.key));
    return (
        <section aria-label={`Interaction videos for ${name}`}>
            <h4>Interaction videos</h4>
            {before?.capture_video === false && <p>Video capture was off for this baseline.</p>}
            {after?.capture_video === false && <p>Video capture was off for this after run.</p>}
            {choices.length === 0 ? (
                <p>{selectedTests?.length === 0 ? "No tests selected for video comparison." : "No recordings for the selected tests in these runs."}</p>
            ) : (
                choices.map((entry, index) => (
                    <section
                        className="video-pair"
                        key={entry.attachment.key}
                        aria-label={`${entry.test.project}: ${entry.test.title}: ${entry.attachment.name}`}
                    >
                        <div className="video-pair-heading">
                            <h4>{entry.test.title}</h4>
                            <span className="badge">
                                {entry.test.project || "Default"} · {index + 1}/
                                {choices.length}
                            </span>
                        </div>
                        <Players
                            key={`${before?.id}-${after?.id}-${entry.attachment.key}`}
                            before={before}
                            after={after}
                            left={left.find(
                                (candidate) =>
                                    candidate.attachment.key ===
                                    entry.attachment.key,
                            )}
                            right={right.find(
                                (candidate) =>
                                    candidate.attachment.key ===
                                    entry.attachment.key,
                            )}
                        />
                    </section>
                ))
            )}
        </section>
    );
}
