import { useContext, useEffect, useRef, useState } from "react";
import { LiveData, readPayload } from "./live-data";
import type { Payload } from "./types";

type ListedTest = { key: string; file: string; title: string; project: string };

async function requestError(response: Response) {
    const data = await response.json().catch(() => null);
    return data?.errors
        ? Object.values(data.errors).flat().join(" ")
        : (data?.message ??
              `Request failed (${response.status}). Please try again.`);
}

export function TestPicker({
    data,
    onClose,
}: {
    data: Payload;
    onClose: () => void;
}) {
    const session = data.props.session!;
    const live = useContext(LiveData)!;
    const dialog = useRef<HTMLDialogElement>(null);
    const request = useRef<AbortController | null>(null);
    const configurations = [
        ...new Set(
            [
                session.environment.project.playwright_config,
                ...session.suites.map((suite) => suite.config),
            ].filter((value): value is string => !!value),
        ),
    ];
    const [config, setConfig] = useState(
        configurations[0] ?? "playwright.config.ts",
    );
    const [name, setName] = useState("Selected tests");
    const [tests, setTests] = useState<ListedTest[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");

    async function loadTests() {
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setLoading(true);
        setError("");
        setLoaded(false);
        setTests([]);
        setSelected(new Set());
        try {
            const response = await fetch(
                `/sessions/${session.id}/test-catalog`,
                {
                    method: "POST",
                    signal: controller.signal,
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "X-CSRF-TOKEN": data.csrf,
                    },
                    body: JSON.stringify({ config }),
                },
            );
            if (!response.ok) throw new Error(await requestError(response));
            const catalog = await response.json();
            if (!controller.signal.aborted) {
                setTests(catalog.tests);
                setLoaded(true);
            }
        } catch (error) {
            if (!controller.signal.aborted)
                setError(
                    error instanceof Error
                        ? error.message
                        : "Could not load tests. Please try again.",
                );
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }

    useEffect(() => {
        const opener = document.activeElement;
        const element = dialog.current;
        element?.showModal();
        void loadTests();
        return () => {
            request.current?.abort();
            element?.close();
            if (opener instanceof HTMLElement) opener.focus();
        };
    }, []);

    const visible = tests.filter((test) =>
        `${test.file} ${test.title} ${test.project}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
    );
    const files = [...new Set(visible.map((test) => test.file))];
    function toggle(keys: string[], checked: boolean) {
        setSelected((current) => {
            const next = new Set(current);
            keys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
            return next;
        });
    }

    return (
        <dialog
            ref={dialog}
            className="test-picker"
            aria-labelledby="test-picker-title"
            onCancel={(event) => {
                event.preventDefault();
                if (!saving) onClose();
            }}
        >
            <form
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                        saving ||
                        loading ||
                        !selected.size ||
                        selected.size > 500
                    )
                        return;
                    setSaving(true);
                    setError("");
                    live.setPending(true);
                    try {
                        const response = await fetch(
                            `/sessions/${session.id}/selected-tests`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Accept: "application/json",
                                    "X-CSRF-TOKEN": data.csrf,
                                },
                                body: JSON.stringify({
                                    config,
                                    name,
                                    test_keys: [...selected],
                                }),
                            },
                        );
                        if (!response.ok)
                            throw new Error(await requestError(response));
                        const next = await readPayload(response);
                        live.update(next);
                        onClose();
                    } catch (error) {
                        setError(
                            error instanceof Error
                                ? error.message
                                : "Could not add tests. Please try again.",
                        );
                    } finally {
                        setSaving(false);
                        live.setPending(false);
                    }
                }}
            >
                <div className="picker-heading">
                    <div>
                        <span className="eyebrow">BUILD YOUR REVIEW SUITE</span>
                        <h2 id="test-picker-title">
                            Add tests to this session
                        </h2>
                        <p>
                            Browse the tests in your project and choose what to
                            capture. No regex needed.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close test picker"
                        disabled={saving}
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>
                <div className="picker-config">
                    <label>
                        Test configuration
                        <input
                            list="picker-configurations"
                            value={config}
                            disabled={loading || saving}
                            onChange={(event) => {
                                setConfig(event.target.value);
                                setLoaded(false);
                                setTests([]);
                                setSelected(new Set());
                            }}
                            required
                        />
                    </label>
                    <datalist id="picker-configurations">
                        {configurations.map((path) => (
                            <option key={path} value={path} />
                        ))}
                    </datalist>
                    <button
                        type="button"
                        disabled={loading || saving || !config.trim()}
                        onClick={() => void loadTests()}
                    >
                        {loading
                            ? "Loading tests…"
                            : loaded
                              ? "Reload tests"
                              : "Load tests"}
                    </button>
                </div>
                <p className="picker-hint">
                    The project’s configured test file is selected by default.
                    Loading lists tests without running them.
                </p>
                {error && (
                    <p role="alert" className="notice error">
                        {error}
                    </p>
                )}
                {loading && (
                    <p role="status" className="notice">
                        Discovering tests… This may take a few seconds.
                    </p>
                )}
                {loaded && (
                    <>
                        <div className="picker-search">
                            <label>
                                Find tests
                                <input
                                    type="search"
                                    value={query}
                                    disabled={saving}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    placeholder="Search test names, files, or browser projects"
                                />
                            </label>
                            <span role="status">
                                {visible.length} of {tests.length} tests ·{" "}
                                {selected.size} selected
                            </span>
                        </div>
                        <div className="picker-selection-actions">
                            <button
                                type="button"
                                disabled={saving || !visible.length}
                                onClick={() =>
                                    toggle(
                                        visible.map((test) => test.key),
                                        true,
                                    )
                                }
                            >
                                Select visible tests
                            </button>
                            <button
                                type="button"
                                disabled={saving || !selected.size}
                                onClick={() => setSelected(new Set())}
                            >
                                Clear selection
                            </button>
                        </div>
                        <div
                            className="picker-test-list"
                            aria-label="Available tests"
                        >
                            {!tests.length ? (
                                <div className="picker-empty">
                                    <h3>No tests found</h3>
                                    <p>
                                        Check the configuration or add a
                                        Playwright test to your project, then
                                        reload tests.
                                    </p>
                                </div>
                            ) : !visible.length ? (
                                <div className="picker-empty">
                                    <h3>No matching tests</h3>
                                    <p>
                                        Try another name or file. Your selected
                                        tests are kept.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setQuery("")}
                                    >
                                        Clear search
                                    </button>
                                </div>
                            ) : (
                                files.map((file) => (
                                    <details
                                        className="picker-file"
                                        key={file}
                                        open
                                    >
                                        <summary>
                                            <code>{file}</code>
                                            <span>
                                                {
                                                    visible.filter(
                                                        (test) =>
                                                            test.file === file,
                                                    ).length
                                                }{" "}
                                                tests
                                            </span>
                                        </summary>
                                        {visible
                                            .filter(
                                                (test) => test.file === file,
                                            )
                                            .map((test) => (
                                                <label
                                                    className="picker-test"
                                                    key={test.key}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Select ${test.title} (${test.project || "Default project"})`}
                                                        checked={selected.has(
                                                            test.key,
                                                        )}
                                                        disabled={saving}
                                                        onChange={(event) =>
                                                            toggle(
                                                                [test.key],
                                                                event.target
                                                                    .checked,
                                                            )
                                                        }
                                                    />
                                                    <span>
                                                        {test.title.startsWith(
                                                            `${file} › `,
                                                        )
                                                            ? test.title.slice(
                                                                  file.length +
                                                                      3,
                                                              )
                                                            : test.title}
                                                        <small>
                                                            {test.project ||
                                                                "Default project"}
                                                        </small>
                                                    </span>
                                                </label>
                                            ))}
                                    </details>
                                ))
                            )}
                        </div>
                    </>
                )}
                <div className="picker-footer">
                    <label>
                        Suite name
                        <input
                            value={name}
                            required
                            maxLength={120}
                            disabled={saving}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </label>
                    <div>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            className="primary"
                            disabled={
                                loading ||
                                saving ||
                                !loaded ||
                                !selected.size ||
                                selected.size > 500 ||
                                !name.trim()
                            }
                        >
                            {saving
                                ? "Adding tests…"
                                : `Add ${selected.size} selected ${selected.size === 1 ? "test" : "tests"}`}
                        </button>
                    </div>
                    {selected.size > 500 && (
                        <p role="alert">Choose at most 500 tests per suite.</p>
                    )}
                    {saving && (
                        <p role="status">
                            Checking your selection and adding tests…
                        </p>
                    )}
                </div>
            </form>
        </dialog>
    );
}
