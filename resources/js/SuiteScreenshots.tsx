import { useEffect, useRef, useState } from "react";
import type { SuiteRun } from "./types";
import { highlightPixels } from "./pixel-diff";

const screenshots = (run?: SuiteRun) =>
    run?.report?.tests.flatMap((test) =>
        test.attachments
            .filter((attachment) => attachment.contentType === "image/png")
            .map((attachment) => ({
                test,
                attachment,
                url: `/suite-runs/${run!.id}/artifacts/${attachment.file}`,
            })),
    ) ?? [];
type Shot = ReturnType<typeof screenshots>[number];

function ScreenshotPair({ left, right }: { left?: Shot; right?: Shot }) {
    const a = useRef<HTMLCanvasElement>(null),
        b = useRef<HTMLCanvasElement>(null);
    const [highlight, setHighlight] = useState(true),
        [tolerance, setTolerance] = useState(16);
    const [message, setMessage] = useState(""),
        [error, setError] = useState("");
    useEffect(() => {
        let cancelled = false;
        setError("");
        setMessage(
            left && right
                ? "Comparing screenshots…"
                : "Not compared: a matching screenshot is missing.",
        );
        async function render() {
            const images = await Promise.all(
                [left, right].map((shot) =>
                    shot
                        ? new Promise<HTMLImageElement>((resolve, reject) => {
                              const image = new Image();
                              image.onload = () => resolve(image);
                              image.onerror = () =>
                                  reject(
                                      new Error(
                                          "Screenshot could not be loaded. Open the original to retry.",
                                      ),
                                  );
                              image.src = shot.url;
                          })
                        : undefined,
                ),
            );
            if (cancelled) return;
            const pixels = images.map((image, index) => {
                const canvas = index ? b.current : a.current;
                if (!canvas || !image) return;
                // Bound browser memory for very large full-page artifacts without silently resizing.
                if (image.naturalWidth * image.naturalHeight > 16_000_000)
                    throw new Error(
                        "Screenshot is too large for highlighting. Open the original at full resolution.",
                    );
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext("2d")!;
                context.drawImage(image, 0, 0);
                return context.getImageData(0, 0, canvas.width, canvas.height);
            });
            if (pixels[0] && pixels[1]) {
                const diff = highlightPixels(pixels[0], pixels[1], tolerance);
                setMessage(
                    `${diff.changed.toLocaleString()} / ${diff.total.toLocaleString()} pixels changed (${((100 * diff.changed) / diff.total).toFixed(2)}%). Before ${pixels[0].width}×${pixels[0].height}; after ${pixels[1].width}×${pixels[1].height}.`,
                );
                if (highlight)
                    [a.current!, b.current!].forEach((canvas, index) => {
                        const data = pixels[index]!;
                        data.data.set(index ? diff.right : diff.left);
                        canvas.getContext("2d")!.putImageData(data, 0, 0);
                    });
            }
        }
        void render().catch((reason) => {
            if (!cancelled) {
                setError(
                    reason instanceof Error
                        ? reason.message
                        : "Screenshot comparison failed.",
                );
                setMessage("Not compared.");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [left?.url, right?.url, highlight, tolerance]);
    return (
        <>
            <div className="filters">
                <button
                    type="button"
                    aria-pressed={highlight}
                    onClick={() => setHighlight(!highlight)}
                >
                    {highlight ? "Show originals" : "Highlight differences"}
                </button>
                <label>
                    Pixel tolerance
                    <select
                        value={tolerance}
                        onChange={(event) =>
                            setTolerance(Number(event.target.value))
                        }
                    >
                        <option value={0}>Exact</option>
                        <option value={16}>Normal</option>
                        <option value={40}>Ignore subtle changes</option>
                    </select>
                </label>
            </div>
            <p role="status">{message}</p>
            {error && <p role="alert">{error}</p>}
            <p>
                <span className="contract-status removed">
                    − Before changes
                </span>{" "}
                <span className="contract-status added">+ After changes</span>{" "}
                Pixel highlights show appearance differences, not semantic
                additions or removals.
            </p>
            <div className="comparison screenshot-comparison">
                {[left, right].map((shot, index) => (
                    <article className="capture-panel" key={index}>
                        <h4>{index ? "+ After" : "− Before"}</h4>
                        {shot ? (
                            <>
                                <div className="screenshot-scroll">
                                    <canvas
                                        hidden={!!error}
                                        ref={index ? b : a}
                                        aria-label={`${index ? "After" : "Before"} screenshot with ${highlight ? "differences highlighted" : "original colors"}`}
                                    />
                                </div>
                                <a
                                    href={shot.url}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    Open {index ? "after" : "before"} original
                                </a>
                            </>
                        ) : (
                            <p>No {index ? "after" : "before"} screenshot.</p>
                        )}
                    </article>
                ))}
            </div>
        </>
    );
}

export function SuiteScreenshots({
    before,
    after,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
}) {
    const [checkpoint, setCheckpoint] = useState(""),
        [capture, setCapture] = useState("");
    const left = screenshots(before),
        right = screenshots(after);
    const keys = [
        ...new Set([...left, ...right].map((shot) => shot.attachment.key)),
    ];
    const pairs = keys.map((key) => {
        const a = left.find((shot) => shot.attachment.key === key),
            b = right.find((shot) => shot.attachment.key === key);
        return { key, a, b, shot: (b ?? a)! };
    });
    const names = [...new Set(pairs.map((pair) => pair.shot.attachment.name))];
    const selectedName = names.includes(checkpoint) ? checkpoint : names[0];
    const choices = pairs.filter(
        (pair) => pair.shot.attachment.name === selectedName,
    );
    const selected =
        choices.find((pair) => pair.key === capture) ??
        choices.find((pair) => pair.a && pair.b) ??
        choices[0];
    return (
        <section aria-label="Screenshot comparisons">
            <h3>Visual checkpoints</h3>
            <p>
                One highlighted comparison at a time. Checkpoint names come from
                captured attachments; use Videos for the full test flow.
            </p>
            {!keys.length ? (
                <p>No PNG screenshots attached to these runs.</p>
            ) : (
                <>
                    <div className="filters">
                        <label>
                            Page or component checkpoint
                            <select
                                value={selectedName}
                                onChange={(event) => {
                                    setCheckpoint(event.target.value);
                                    setCapture("");
                                }}
                            >
                                {names.map((name) => (
                                    <option key={name}>{name}</option>
                                ))}
                            </select>
                        </label>
                        {choices.length > 1 && (
                            <label>
                                Capture variant
                                <select
                                    value={selected.key}
                                    onChange={(event) =>
                                        setCapture(event.target.value)
                                    }
                                >
                                    {choices.map((pair, index) => (
                                        <option value={pair.key} key={pair.key}>
                                            {pair.shot.test.project ||
                                                "Default"}{" "}
                                            · {pair.shot.test.title} ·{" "}
                                            {index + 1}
                                            {!pair.a
                                                ? " · After only"
                                                : !pair.b
                                                  ? " · Before only"
                                                  : ""}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                    <p className="evidence-scope">
                        {names.length} named checkpoints · {keys.length}{" "}
                        captured comparisons. Showing{" "}
                        {selected.shot.test.project || "Default"} ·{" "}
                        {selected.shot.test.title}.
                    </p>
                    <ScreenshotPair
                        key={`${before?.id}-${after?.id}-${selected.key}`}
                        left={selected.a}
                        right={selected.b}
                    />
                </>
            )}
        </section>
    );
}
