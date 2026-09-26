import { useState } from "react";
import { Form } from "./forms";
import { SuiteVideos } from "./SuiteVideos";
import { DevDetails } from "./DevDetails";
import { SuiteManager } from "./SuiteManager";
import { CoverageSummary } from "./CoverageSummary";
import { plainOutput } from "./plain-output";
import type { Payload, SuiteRun } from "./types";

function captureLabel(run: SuiteRun): string {
    const date = run.created_at ? new Date(run.created_at) : null;
    const captured =
        date && !Number.isNaN(date.getTime())
            ? ` · ${date.toLocaleString()}`
            : "";
    return `#${run.id} · ${run.status} · ${run.report?.outcome ?? "No report"}${captured}`;
}

export function SuiteComparisons({
    data,
    tab,
}: {
    data: Payload;
    tab: string;
}) {
    const session = data.props.session!;
    const storageKey = `comparison-suite-${session.id}`;
    const [suiteId, setSuiteId] = useState(() => {
        try {
            return sessionStorage.getItem(storageKey) ?? "";
        } catch {
            return "";
        }
    });
    function selectSuite(id: string) {
        setSuiteId(id);
        setVersion(savedVersion(id));
        try {
            sessionStorage.setItem(storageKey, id);
        } catch {
            /* Selection still works without storage. */
        }
    }
    const suite =
        session.suites.find((suite) => String(suite.id) === suiteId) ??
        session.suites.at(-1);
    function savedVersion(id: string | number | undefined): string {
        try {
            return (
                sessionStorage.getItem(
                    `comparison-version-${session.id}-${id}`,
                ) ?? ""
            );
        } catch {
            return "";
        }
    }
    const [version, setVersion] = useState(() => savedVersion(suite?.id));
    function selectVersion(value: string) {
        setVersion(value);
        try {
            sessionStorage.setItem(
                `comparison-version-${session.id}-${suite?.id}`,
                value,
            );
        } catch {
            /* Version selection remains usable without browser storage. */
        }
    }
    const baselineRuns =
        session.baseline?.runs ??
        session.suites.flatMap((item) =>
            item.runs
                .filter(
                    (run) =>
                        run.phase === "before" && run.status === "complete",
                )
                .map((run) => ({
                    ...run,
                    config: item.config,
                    test_suite_id: item.id,
                })),
        );
    const before =
        baselineRuns.find((run) => run.test_suite_id === suite?.id) ??
        baselineRuns.find((run) => run.config === suite?.config) ??
        baselineRuns[0];
    const afterRuns = suite?.runs.filter((run) => run.phase === "after") ?? [];
    const after =
        afterRuns.find((run) => String(run.id) === version) ?? afterRuns.at(-1);
    const selectedVersion = afterRuns.some((run) => String(run.id) === version)
        ? version
        : "";
    const busy = data.props.active;
    const hasSessionBaseline = baselineRuns.length > 0;
    const eligibleIds = session.baseline?.suite_ids;
    const needsBaseline = eligibleIds
        ? session.suites.some(
              (item) =>
                  eligibleIds.includes(item.id) &&
                  !baselineRuns.some((run) => run.test_suite_id === item.id),
          )
        : !hasSessionBaseline;
    const suiteNeedsBaseline =
        needsBaseline &&
        (!eligibleIds || eligibleIds.includes(suite?.id ?? -1)) &&
        !baselineRuns.some((run) => run.test_suite_id === suite?.id);
    return (
        <section className="suite-comparisons">
            <div
                role="tabpanel"
                id="panel-overview"
                aria-labelledby="tab-overview"
                hidden={tab !== "overview"}
            >
                <SuiteManager
                    data={data}
                    selectedId={suite?.id}
                    onSelect={selectSuite}
                />
                <div className="filters overview-controls">
                    {suite && (
                        <label>
                            Test suite
                            <select
                                value={suite.id}
                                onChange={(event) =>
                                    selectSuite(event.target.value)
                                }
                            >
                                {session.suites.map((suite) => (
                                    <option key={suite.id} value={suite.id}>
                                        {suite.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {suite && afterRuns.length > 0 && (
                        <label>
                            After version
                            <select
                                aria-label={`After version for ${suite.name}`}
                                value={selectedVersion}
                                onChange={(event) =>
                                    selectVersion(event.target.value)
                                }
                            >
                                <option value="">Latest after run</option>
                                {afterRuns.map((run) => (
                                    <option key={run.id} value={run.id}>
                                        {captureLabel(run)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <div className="capture-controls">
                        <span>Capture all suites</span>
                        <div className="actions">
                            {["before", "after"].map((phase) => (
                                <Form
                                    key={phase}
                                    action={`/sessions/${session.id}/captures`}
                                    csrf={data.csrf}
                                >
                                    <input
                                        type="hidden"
                                        name="phase"
                                        value={phase}
                                    />
                                    <button
                                        className={
                                            phase === "after" ? "primary" : ""
                                        }
                                        disabled={
                                            busy ||
                                            !session.suites.length ||
                                            (phase === "before"
                                                ? !needsBaseline
                                                : !hasSessionBaseline)
                                        }
                                    >
                                        {phase === "before" &&
                                        hasSessionBaseline &&
                                        !needsBaseline
                                            ? "Baseline locked"
                                            : `Capture ${phase}`}
                                    </button>
                                </Form>
                            ))}
                        </div>
                    </div>
                </div>
                {suite && (
                    <div
                        className="review-shortcuts"
                        aria-label="Evidence shortcuts"
                    >
                        <a
                            className="button primary"
                            href={`?tab=dev&section=review`}
                        >
                            Review changed code
                        </a>
                        <a className="button" href={`?tab=dev&section=tests`}>
                            Inspect test results
                        </a>
                        <a
                            className="button"
                            href={`?tab=dev&section=contracts`}
                        >
                            Compare contracts
                        </a>
                    </div>
                )}
                {suite && (
                    <CoverageSummary
                        before={before}
                        after={after}
                        selectedTests={suite.selected_tests}
                    />
                )}
            </div>
            {suite ? (
                <section
                    className="suite-evidence"
                    aria-label={`Suite ${suite.name}`}
                >
                    <div className="heading" hidden={tab !== "overview"}>
                        <div>
                            <h3>{suite.name}</h3>
                            <code>{suite.config}</code>
                            {suite.grep && <p>{suite.grep}</p>}
                        </div>
                        <div className="actions">
                            {["before", "after"].map((phase) => (
                                <Form
                                    key={phase}
                                    action={`/suites/${suite.id}/runs`}
                                    csrf={data.csrf}
                                >
                                    <input
                                        type="hidden"
                                        name="phase"
                                        value={phase}
                                    />
                                    <button
                                        disabled={
                                            busy ||
                                            (phase === "before"
                                                ? !suiteNeedsBaseline
                                                : !hasSessionBaseline)
                                        }
                                    >
                                        {phase === "before" &&
                                        !suiteNeedsBaseline
                                            ? "Session baseline reused"
                                            : `Run suite ${phase}`}
                                    </button>
                                </Form>
                            ))}
                        </div>
                    </div>
                    {suite.runs.at(-1)?.error && (
                        <p role="alert">
                            {plainOutput(suite.runs.at(-1)?.error ?? "")}
                        </p>
                    )}
                    {hasSessionBaseline && (
                        <p className="baseline-notice">
                            Session baseline locked. All suites reuse its
                            recordings; existing components can use a baseline
                            reference when no same-test recording exists.
                        </p>
                    )}
                    {!before && after && (
                        <p className="notice">
                            No session baseline is available for these tests.
                        </p>
                    )}

                    {tab !== "overview" && (
                        <div className="filters evidence-controls">
                            <label>
                                Review suite
                                <select
                                    value={suite.id}
                                    onChange={(event) =>
                                        selectSuite(event.target.value)
                                    }
                                >
                                    {session.suites.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {!!afterRuns.length && (
                                <label>
                                    Review after version
                                    <select
                                        value={selectedVersion}
                                        onChange={(event) =>
                                            selectVersion(event.target.value)
                                        }
                                    >
                                        <option value="">
                                            Latest after run
                                        </option>
                                        {afterRuns.map((run) => (
                                            <option key={run.id} value={run.id}>
                                                {captureLabel(run)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>
                    )}
                    {tab !== "overview" && (
                        <p className="comparison-context">
                            {suite.name} · Before{" "}
                            {before ? `#${before.id}` : "not captured"} · After{" "}
                            {after ? `#${after.id}` : "not captured"}
                        </p>
                    )}
                    <div
                        role="tabpanel"
                        id="panel-videos"
                        aria-labelledby="tab-videos"
                        hidden={tab !== "videos"}
                    >
                        <SuiteVideos
                            key={`videos-${suite.id}`}
                            before={before}
                            baselineRuns={baselineRuns}
                            config={suite.config}
                            after={after}
                            name={suite.name}
                            active={tab === "videos"}
                            selectedTests={suite.selected_tests}
                        />
                    </div>
                    <div
                        role="tabpanel"
                        id="panel-dev"
                        aria-labelledby="tab-dev"
                        hidden={tab !== "dev"}
                    >
                        <DevDetails
                            key={suite.id}
                            before={before}
                            after={after}
                            runs={before && !suite.runs.some(run => run.id === before.id) ? [before, ...suite.runs] : suite.runs}
                        />
                    </div>
                </section>
            ) : (
                <p>No test suites yet.</p>
            )}
        </section>
    );
}
