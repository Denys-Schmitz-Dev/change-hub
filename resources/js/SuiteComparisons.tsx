import { useState } from "react";
import { Form } from "./forms";
import { SuiteVideos } from "./SuiteVideos";
import { DevDetails } from "./DevDetails";
import { SuiteManager } from "./SuiteManager";
import { CoverageSummary } from "./CoverageSummary";
import { ChangeReview } from "./ChangeReview";
import { plainOutput } from "./plain-output";
import type { Payload, SuiteRun } from "./types";

function combinedRun(runs: SuiteRun[], phase: string): SuiteRun | undefined {
    if (!runs.length) return undefined;
    const source = [...runs].reverse().find((run) => run.report?.contracts) ?? runs.at(-1)!;
    const tests = runs.flatMap((run, index) =>
        (run.report?.tests ?? []).map((test) => ({
            ...test,
            key: `${run.config ?? index}:${test.key}`,
            suiteName: run.suite_name ?? test.suiteName,
        })),
    );
    const complete = runs.every((run) => run.status === "complete");
    return {
        ...source,
        phase,
        status: complete ? "complete" : source.status,
        capture_video: runs.some((run) => run.capture_video),
        report: source.report
            ? {
                  ...source.report,
                  outcome: runs.some((run) => run.report?.outcome === "failed")
                      ? "failed"
                      : source.report.outcome,
                  tests,
                  errors: runs.flatMap((run) =>
                      (run.report?.errors ?? []).map((error) =>
                          run.suite_name ? `${run.suite_name}: ${error}` : error,
                      ),
                  ),
              }
            : null,
    };
}

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
        const requested = new URLSearchParams(location.search).get("suite");
        if (requested) return requested;
        try {
            return sessionStorage.getItem(storageKey) ?? "";
        } catch {
            return "";
        }
    });
    const [captureSuiteId, setCaptureSuiteId] = useState("all");
    function selectSuite(id: string) {
        setSuiteId(id);
        setVersion(savedVersion(id));
        try {
            sessionStorage.setItem(storageKey, id);
        } catch {
            /* Selection still works without storage. */
        }
    }
    const showAllSuites = suiteId === "all";
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
    const baselineRuns = (
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
        )
    ).map((run) => ({
        ...run,
        suite_name: session.suites.find(
            (item) =>
                item.id === run.test_suite_id || item.config === run.config,
        )?.name,
    }));
    const before =
        baselineRuns.find((run) => run.test_suite_id === suite?.id) ??
        baselineRuns.find((run) => run.config === suite?.config) ??
        baselineRuns[0];
    const devBefore = baselineRuns[0];
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
    const captureSuite = session.suites.find(
        (item) => String(item.id) === captureSuiteId,
    );
    const captureSuiteNeedsBaseline = captureSuite
        ? needsBaseline &&
          (!eligibleIds || eligibleIds.includes(captureSuite.id)) &&
          !baselineRuns.some((run) => run.test_suite_id === captureSuite.id)
        : needsBaseline;
    const suiteNeedsBaseline =
        needsBaseline &&
        (!eligibleIds || eligibleIds.includes(suite?.id ?? -1)) &&
        !baselineRuns.some((run) => run.test_suite_id === suite?.id);
    const latestAfterRuns = session.suites.flatMap((item) => {
        const run = item.runs.filter((candidate) => candidate.phase === "after").at(-1);
        return run
            ? [{ ...run, config: item.config, suite_name: item.name }]
            : [];
    });
    const allSuitesComparison = {
        before: combinedRun(baselineRuns, "before"),
        after: combinedRun(latestAfterRuns, "after"),
    };
    const overviewSuites = suite ? [suite] : [];
    const overviewComparison = (item: (typeof session.suites)[number]) => {
        const itemBefore =
            baselineRuns.find((run) => run.test_suite_id === item.id) ??
            baselineRuns.find((run) => run.config === item.config) ??
            baselineRuns[0];
        const itemAfterRuns = item.runs.filter((run) => run.phase === "after");
        const itemAfter =
            item.id === suite?.id && !showAllSuites
                ? after
                : itemAfterRuns.at(-1);
        return { before: itemBefore, after: itemAfter };
    };
    return (
        <section className="suite-comparisons">
            <div
                role="tabpanel"
                id="panel-overview"
                aria-labelledby="tab-overview"
                hidden={tab !== "overview"}
            >
                <div className="capture-controls overview-capture-bar">
                    <label>
                        Capture target
                        <select
                            aria-label="Capture target"
                            value={captureSuiteId}
                            onChange={(event) =>
                                setCaptureSuiteId(event.target.value)
                            }
                        >
                            <option value="all">All suites</option>
                            {session.suites.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="actions">
                        {["before", "after"].map((phase) => (
                            <Form
                                key={phase}
                                action={
                                    captureSuite
                                        ? `/suites/${captureSuite.id}/runs`
                                        : `/sessions/${session.id}/captures`
                                }
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
                                            ? !captureSuiteNeedsBaseline
                                            : !hasSessionBaseline)
                                    }
                                >
                                    {phase === "before" &&
                                    !captureSuiteNeedsBaseline
                                        ? captureSuite
                                            ? "Baseline reused"
                                            : "Baseline locked"
                                        : `Capture ${phase}`}
                                </button>
                            </Form>
                        ))}
                    </div>
                </div>
                <SuiteManager data={data} selectedId={suite?.id} />
                {(showAllSuites ? [null] : overviewSuites).map((item) => {
                    const selectedSuite = item ?? suite!;
                    const comparison = showAllSuites ? allSuitesComparison : overviewComparison(selectedSuite);
                    return <div className="overview-suite-review" key={showAllSuites ? "all" : selectedSuite.id}>
                        <CoverageSummary
                            before={comparison.before}
                            after={comparison.after}
                            selectedTests={showAllSuites ? null : selectedSuite.selected_tests}
                            runLabel={showAllSuites && comparison.after ? `All suites · latest runs · ${comparison.after.status}` : undefined}
                            suiteName={showAllSuites ? undefined : selectedSuite.name}
                            controls={<div className="evidence-selectors">
                                <label>Test suite<select aria-label="Test suite" value={showAllSuites ? "all" : String(suite?.id ?? "")} onChange={(event) => selectSuite(event.target.value)}>
                                    <option value="all">All suites</option>
                                    {session.suites.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                                </select></label>
                                {!showAllSuites && afterRuns.length > 0 && <label>After version<select aria-label={`After version for ${suite!.name}`} value={selectedVersion} onChange={(event) => selectVersion(event.target.value)}><option value="">Latest after run</option>{afterRuns.map((run) => <option key={run.id} value={run.id}>{captureLabel(run)}</option>)}</select></label>}
                            </div>}
                        >
                            <ChangeReview
                                key={`${comparison.before?.id}-${comparison.after?.id}-${JSON.stringify(session.review_approvals ?? [])}`}
                                before={comparison.before}
                                after={comparison.after}
                                sessionId={session.id}
                                csrf={data.csrf}
                                approvals={session.review_approvals ?? []}
                                approvalRunIds={showAllSuites ? latestAfterRuns.map((run) => run.id) : undefined}
                            />
                        </CoverageSummary>
                    </div>;
                })}
            </div>
            {suite && tab !== "overview" ? (
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
                            {(tab === "dev" ? devBefore : before)
                                ? `#${(tab === "dev" ? devBefore : before)!.id}`
                                : "not captured"}{" "}
                            · After {after ? `#${after.id}` : "not captured"}
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
                            before={devBefore}
                            after={after}
                            runs={
                                devBefore &&
                                !suite.runs.some(
                                    (run) => run.id === devBefore.id,
                                )
                                    ? [devBefore, ...suite.runs]
                                    : suite.runs
                            }
                        />
                    </div>
                </section>
            ) : !suite ? (
                <p>No test suites yet.</p>
            ) : null}
        </section>
    );
}
