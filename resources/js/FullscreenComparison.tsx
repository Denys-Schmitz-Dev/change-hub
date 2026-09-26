import { useEffect, useRef, useState, type ReactNode } from "react";

export function FullscreenComparison({
    children,
    enabled,
    active,
    onPlay,
    controls,
}: {
    children: ReactNode;
    controls?: ReactNode;
    enabled: boolean;
    active: boolean;
    onPlay: () => void | Promise<void>;
}) {
    const container = useRef<HTMLDivElement>(null);
    const enterButton = useRef<HTMLButtonElement>(null);
    const exitButton = useRef<HTMLButtonElement>(null);
    const restoreFocus = useRef(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const element = container.current;
        let wasFullscreen = false;
        function changed() {
            const expanded = document.fullscreenElement === element;
            setFullscreen(expanded);
            if (!expanded && wasFullscreen) restoreFocus.current = true;
            wasFullscreen = expanded;
        }
        document.addEventListener("fullscreenchange", changed);
        return () => {
            document.removeEventListener("fullscreenchange", changed);
            if (document.fullscreenElement === element)
                void document.exitFullscreen().catch(() => {});
        };
    }, []);

    useEffect(() => {
        if (fullscreen) exitButton.current?.focus();
        else if (restoreFocus.current) {
            enterButton.current?.focus();
            restoreFocus.current = false;
        }
    }, [fullscreen]);

    useEffect(() => {
        if (!active && document.fullscreenElement === container.current)
            void document.exitFullscreen().catch(() => {});
    }, [active]);

    async function enter() {
        setError("");
        try {
            if (!container.current?.requestFullscreen) {
                setError(
                    "Fullscreen comparison is not supported by this browser.",
                );
                return;
            }
            await container.current.requestFullscreen();
            await onPlay();
        } catch {
            setError(
                "Fullscreen could not open. You can still play both videos in this view.",
            );
        }
    }

    return (
        <div
            ref={container}
            className="fullscreen-comparison"
            aria-label="Video comparison viewer"
            onKeyDown={(event) => {
                if (
                    event.key === "Escape" &&
                    document.fullscreenElement === container.current
                ) {
                    event.preventDefault();
                    void document
                        .exitFullscreen()
                        .catch(() =>
                            setError(
                                "Could not exit fullscreen. Use the browser’s fullscreen controls to exit.",
                            ),
                        );
                }
            }}
        >
            <div className="fullscreen-comparison-toolbar">
                <button
                    ref={enterButton}
                    type="button"
                    hidden={fullscreen}
                    disabled={!enabled}
                    onClick={() => void enter()}
                >
                    Play in fullscreen
                </button>
                {controls}
                <button
                    ref={exitButton}
                    type="button"
                    hidden={!fullscreen}
                    onClick={() =>
                        void document
                            .exitFullscreen()
                            .catch(() =>
                                setError(
                                    "Could not exit fullscreen. Press Escape to exit.",
                                ),
                            )
                    }
                >
                    Exit fullscreen
                </button>
            </div>
            {error && <p role="alert">{error}</p>}
            {children}
        </div>
    );
}
