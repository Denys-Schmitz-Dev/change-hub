import { TestRows, FailureOutput } from "./TestResults";
import { useState } from "react";
import { Form } from "./forms";
import { SuiteScreenshots } from "./SuiteScreenshots";
import { SuiteVideos } from "./SuiteVideos";
import { DevDetails } from "./DevDetails";
import { VideoTestSelection } from "./VideoTestSelection";
import { CoverageSummary } from "./CoverageSummary";
import type { Payload, SuiteRun } from "./types";

function Results({ run }: { run?: SuiteRun }) {
    return <section><p>{run ? `Run #${run.id} · ${run.status} · ${run.report?.outcome ?? ""}` : "No run"}</p>
        {run?.error && <p role="alert">{run.error}</p>}
        <FailureOutput run={run} />
        <TestRows tests={run?.report?.tests ?? []} run={run} />
    </section>;
}

export function SuiteComparisons({ data, tab }: { data: Payload; tab: string }) {
    const session = data.props.session!;
    const storageKey = `comparison-suite-${session.id}`;
    const [suiteId, setSuiteId] = useState(() => { try { return sessionStorage.getItem(storageKey) ?? ""; } catch { return ""; } });
    const [version, setVersion] = useState("");
    const suite = session.suites.find(suite => String(suite.id) === suiteId) ?? session.suites.at(-1);
    const before = suite?.runs.find(run => run.phase === "before" && run.status === "complete");
    const afterRuns = suite?.runs.filter(run => run.phase === "after") ?? [];
    const after = afterRuns.find(run => String(run.id) === version) ?? afterRuns.at(-1);
    const busy = data.props.active;
    const hasSessionBaseline = session.suites.some(suite => suite.runs.some(run => run.phase === "before" && run.status === "complete"));
    return <section className="suite-comparisons">
        <div className="filters">
            {suite && <label>Test suite<select value={suite.id} onChange={event => {
                setSuiteId(event.target.value); setVersion(""); try { sessionStorage.setItem(storageKey, event.target.value); } catch { /* Selection remains usable without storage. */ }
            }}>{session.suites.map(suite => <option key={suite.id} value={suite.id}>{suite.name}</option>)}</select></label>}
            {suite && afterRuns.length > 0 && <label>After version<select aria-label={`After version for ${suite.name}`} value={after?.id ?? ""} onChange={event => setVersion(event.target.value)}>
                {afterRuns.map((run, index) => <option key={run.id} value={run.id}>#{index + 1} · {run.status} · {run.report?.outcome}</option>)}
            </select></label>}
        </div>
        {suite ? <section className="suite-evidence" aria-label={`Suite ${suite.name}`}>
            <div className="heading"><div><h3>{suite.name}</h3><code>{suite.config}</code>{suite.grep && <p>{suite.grep}</p>}</div>
                <div className="actions">{["before", "after"].map(phase => <Form key={phase} action={`/suites/${suite.id}/runs`} csrf={data.csrf}>
                    <input type="hidden" name="phase" value={phase} />
                    <button disabled={busy || (phase === "before" ? !!before : !hasSessionBaseline)}>{phase === "before" && before ? "Suite baseline locked" : `Run suite ${phase}`}</button>
                </Form>)}</div>
            </div>
            {suite.runs.at(-1)?.error && <p role="alert">{suite.runs.at(-1)?.error}</p>}
            {!before && after && <p className="notice">Added during this change. No before recording is available for this suite.</p>}
            <CoverageSummary before={before} after={after} selectedTests={suite.selected_tests} showAreas={tab !== "dev"} />
            <div role="tabpanel" id="panel-videos" aria-labelledby="tab-videos" hidden={tab !== "videos"}>
                <VideoTestSelection key={`selection-${suite.id}`} suite={suite} csrf={data.csrf} />
                <SuiteVideos key={`videos-${suite.id}`} before={before} after={after} name={suite.name} selectedTests={suite.selected_tests} />
            </div>
            <div role="tabpanel" id="panel-screenshots" aria-labelledby="tab-screenshots" hidden={tab !== "screenshots"}>
                {tab === "screenshots" && <SuiteScreenshots before={before} after={after} />}
            </div>
            <div role="tabpanel" id="panel-dev" aria-labelledby="tab-dev" hidden={tab !== "dev"}>
                <DevDetails key={suite.id} before={before} after={after} />
                <details><summary>Test results</summary><div className="comparison"><div><h4>Before</h4><Results run={before} /></div><div><h4>After</h4><Results run={after} /></div></div></details>
                <details><summary>Run history ({suite.runs.length})</summary>{suite.runs.map(run => <Results key={run.id} run={run} />)}</details>
            </div>
        </section> : <p>No test suites yet.</p>}
        <details><summary>Add a Playwright suite</summary>
            <Form action={`/sessions/${session.id}/suites`} csrf={data.csrf}>
                <label>Suite name<input name="name" required maxLength={120} /></label>
                <label>Suite config path<input name="config" required defaultValue={session.environment.project.playwright_config ?? ""} /></label>
                <label>Test title filter (optional regex)<input name="grep" maxLength={200} /></label>
                <button className="primary">Add suite</button>
            </Form>
        </details>
    </section>;
}
