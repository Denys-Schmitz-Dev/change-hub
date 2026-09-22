import { useEffect, useState } from "react";
import type { Payload } from "./types";
import { Form } from "./forms";
import { SuiteComparisons } from "./SuiteComparisons";

export function Comparison({ data }: { data: Payload }) {
    const { session, active } = data.props;
    const [tab, setTab] = useState(["dev", "screenshots"].includes(new URLSearchParams(location.search).get("tab") ?? "") ? new URLSearchParams(location.search).get("tab")! : "videos");
    useEffect(() => {
        if (!active) return;
        const timer = setTimeout(() => location.reload(), 2500);
        return () => clearTimeout(timer);
    }, [active]);
    if (!session) return null;
    const hasBaseline = session.suites.some(suite => suite.runs.some(run => run.phase === "before" && run.status === "complete"));
    const needsBaseline = session.suites.some(suite => !suite.runs.some(run => run.phase === "before" && run.status === "complete"));
    return <>
        <div className="heading"><div><span className="eyebrow">{session.environment.project.name} / {session.environment.name}</span><h1>{session.title}</h1></div>
            <div className="actions">{["before", "after"].map(phase => <Form key={phase} action={`/sessions/${session.id}/captures`} csrf={data.csrf}>
                <input type="hidden" name="phase" value={phase} />
                <button className={phase === "after" ? "primary" : ""} disabled={active || !session.suites.length || (phase === "before" ? !needsBaseline : !hasBaseline)}>
                    {phase === "before" && hasBaseline && !needsBaseline ? "Baseline locked" : `Capture ${phase}`}
                </button>
            </Form>)}</div>
        </div>
        {active && <div role="status" className="notice" data-refresh>Tests are queued or running.</div>}
        <div className="comparison-tabs" role="tablist" aria-label="Comparison views">{[["videos", "Videos"], ["screenshots", "Screenshots"], ["dev", "Dev details"]].map(([value, label]) => <button type="button" role="tab" key={value} id={`tab-${value}`} aria-controls={`panel-${value}`} aria-selected={tab === value} onClick={() => {
            setTab(value); const url = new URL(location.href); url.searchParams.set("tab", value); history.replaceState(null, "", url);
        }}>{label}</button>)}</div>
        <SuiteComparisons data={data} tab={tab} />
    </>;
}
