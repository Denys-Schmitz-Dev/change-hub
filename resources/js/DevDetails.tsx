import { TestExplorer } from "./TestExplorer";
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

export function DevDetails({
    before,
    after,
    runs,
}: {
    before?: SuiteRun;
    after?: SuiteRun;
    runs: SuiteRun[];
}) {
    const [query, setQuery] = useState("");
    const [view, setView] = useState(() => {
        const section = new URLSearchParams(location.search).get("section");
        return section && ["tests", "review", "contracts"].includes(section) ? section : "tests";
    });
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
                    ["tests", "Test explorer"],
                    ["review", "Change review"],
                    ["contracts", "Contract diffs"],
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
            {view === "tests" && (
                <TestExplorer
                    key={`${before?.id}-${after?.id}`}
                    runs={runs}
                    initialRun={after ?? before}
                />
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
