import { ChangeReview } from "./ChangeReview";
import { useState } from "react";
import type { ContractEntry, SuiteRun } from "./types";
import {
    contractCategories as categories,
    contractChanges as changes,
} from "./coverage-summary";

function Source({
    before,
    after,
}: {
    before?: ContractEntry;
    after?: ContractEntry;
}) {
    const a = before?.signature.split("\n") ?? [],
        b = after?.signature.split("\n") ?? [];
    let prefix = 0,
        suffix = 0;
    while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix])
        prefix++;
    while (
        suffix < Math.min(a.length, b.length) - prefix &&
        a[a.length - suffix - 1] === b[b.length - suffix - 1]
    )
        suffix++;
    return (
        <div className="comparison source-diff">
            {[
                { title: "Before", entry: before, lines: a, kind: "removed" },
                { title: "After", entry: after, lines: b, kind: "added" },
            ].map(({ title, entry, lines, kind }) => (
                <div key={title}>
                    <h4>
                        {title}
                        {entry && ` · line ${entry.line}`}
                    </h4>
                    {entry ? (
                        <pre>
                            {lines.map((line, i) => (
                                <span
                                    className={
                                        i >= prefix && i < lines.length - suffix
                                            ? `diff-line ${kind}`
                                            : "diff-line"
                                    }
                                    key={i}
                                >
                                    <span className="line-number">
                                        {entry.line + i}
                                    </span>
                                    {line || " "}
                                    {"\n"}
                                </span>
                            ))}
                        </pre>
                    ) : (
                        <p>Not present</p>
                    )}
                    {entry?.truncated && <p>Source preview truncated.</p>}
                </div>
            ))}
        </div>
    );
}

function Events({
    before,
    after,
    kind,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
    kind: "console" | "network";
}) {
    const keys = [
        ...new Set(
            [
                ...(before?.report?.tests ?? []),
                ...(after?.report?.tests ?? []),
            ].map((test) => test.key),
        ),
    ];
    return (
        <section
            className="contract-section"
            aria-label={kind === "console" ? "Console" : "Network"}
        >
            <h3>{kind === "console" ? "Console" : "Network"}</h3>
            {!keys.length && <p>No test evidence yet.</p>}
            {keys.map((key) => {
                const left = before?.report?.tests.find(
                        (test) => test.key === key,
                    ),
                    right = after?.report?.tests.find(
                        (test) => test.key === key,
                    );
                const a = left?.diagnostics?.[kind],
                    b = right?.diagnostics?.[kind];
                const counts = (items: string[]) => {
                    const map = new Map<string, number>();
                    items.forEach((item) =>
                        map.set(item, (map.get(item) ?? 0) + 1),
                    );
                    return map;
                };
                const ac = counts(a ?? []),
                    bc = counts(b ?? []);
                const comparable = a !== undefined && b !== undefined;
                const rows = [...new Set([...ac.keys(), ...bc.keys()])].filter(
                    (value) => !comparable || ac.get(value) !== bc.get(value),
                );
                return (
                    <details key={key}>
                        <summary>
                            {(right ?? left)!.project} ·{" "}
                            {(right ?? left)!.title} ·{" "}
                            {comparable
                                ? `${rows.length} differences`
                                : "Not compared"}
                        </summary>
                        {!comparable && (
                            <p>
                                Before: {a ? "Recorded" : "Not recorded"} ·
                                After: {b ? "Recorded" : "Not recorded"}
                            </p>
                        )}
                        {comparable && !rows.length && <p>No differences.</p>}
                        {rows.map((value) => (
                            <div className="event-diff" key={value}>
                                <span className="contract-status removed">
                                    Before {ac.get(value) ?? 0}
                                </span>
                                <span className="contract-status added">
                                    After {bc.get(value) ?? 0}
                                </span>
                                <code>{value}</code>
                            </div>
                        ))}
                        {[left, right].map((test, index) =>
                            test?.diagnostics?.warnings.map((warning, i) => (
                                <p
                                    className="notice error"
                                    key={`${index}-${i}`}
                                >
                                    {index ? "After" : "Before"}: {warning}
                                </p>
                            )),
                        )}
                    </details>
                );
            })}
        </section>
    );
}

export function DevDetails({
    before,
    after,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
}) {
    const [query, setQuery] = useState("");
    const [view, setView] = useState("review");
    const left = before?.report?.contracts,
        right = after?.report?.contracts;
    const comparable =
        before?.status === "complete" &&
        after?.status === "complete" &&
        left?.version === 1 &&
        right?.version === 1;
    return (
        <section className="dev-details" aria-label="Developer details">
            <div
                className="detail-navigation"
                role="group"
                aria-label="Developer detail sections"
            >
                {[
                    ["review", "Change review"],
                    ["contracts", "Contract diffs"],
                    ["runtime", "Runtime logs"],
                ].map(([value, label]) => (
                    <button
                        type="button"
                        key={value}
                        aria-pressed={view === value}
                        onClick={() => setView(value)}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {view === "review" && (
                <ChangeReview
                    key={`${before?.id}-${after?.id}`}
                    before={before}
                    after={after}
                />
            )}
            {view === "runtime" && (
                <div className="runtime-grid">
                    <Events before={before} after={after} kind="console" />
                    <Events before={before} after={after} kind="network" />
                </div>
            )}
            <div hidden={view !== "contracts"}>
                <h2>Contract changes</h2>
                <label>
                    Filter files or contracts
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
                {!comparable && (
                    <p className="notice">
                        Contract comparison needs before and after source
                        snapshots.
                    </p>
                )}
                {[left, right].map((snapshot, index) =>
                    snapshot?.warnings.map((warning, i) => (
                        <p className="notice error" key={`${index}-${i}`}>
                            {index ? "After" : "Before"}: {warning}
                        </p>
                    )),
                )}
                {categories.map(([key, title]) => {
                    const entries = comparable
                        ? changes(
                              left!.categories[key] ?? [],
                              right!.categories[key] ?? [],
                          )
                        : [];
                    const filtered = entries.filter((entry) =>
                        `${entry.after?.file ?? entry.before?.file} ${entry.after?.label ?? entry.before?.label}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                    );
                    const files = [
                        ...new Set(
                            filtered.map(
                                (entry) => (entry.after ?? entry.before)!.file,
                            ),
                        ),
                    ].sort();
                    return (
                        <section
                            className="contract-section"
                            aria-label={title}
                            key={key}
                        >
                            <div className="heading">
                                <h3>{title}</h3>
                                <span className="badge">
                                    {comparable
                                        ? `${entries.length} changes`
                                        : "Not compared"}
                                </span>
                            </div>
                            {comparable && !files.length && (
                                <p>
                                    {entries.length
                                        ? "No matching files."
                                        : "No changes detected."}
                                </p>
                            )}
                            {files.map((file) => (
                                <details key={file} className="file-diff">
                                    <summary>
                                        <code>{file}</code> ·{" "}
                                        {
                                            filtered.filter(
                                                (entry) =>
                                                    (entry.after ??
                                                        entry.before)!.file ===
                                                    file,
                                            ).length
                                        }{" "}
                                        changes
                                    </summary>
                                    {filtered
                                        .filter(
                                            (entry) =>
                                                (entry.after ?? entry.before)!
                                                    .file === file,
                                        )
                                        .map((entry) => (
                                            <details key={entry.key}>
                                                <summary>
                                                    <span
                                                        className={`contract-status ${entry.status.toLowerCase()}`}
                                                    >
                                                        {entry.status}
                                                    </span>{" "}
                                                    {
                                                        (entry.after ??
                                                            entry.before)!.label
                                                    }
                                                </summary>
                                                <Source
                                                    before={entry.before}
                                                    after={entry.after}
                                                />
                                            </details>
                                        ))}
                                </details>
                            ))}
                        </section>
                    );
                })}
            </div>
        </section>
    );
}
