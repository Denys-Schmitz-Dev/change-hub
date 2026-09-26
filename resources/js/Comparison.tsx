import type { Payload } from "./types";
import { SuiteComparisons } from "./SuiteComparisons";

export function Comparison({ data, tab }: { data: Payload; tab: string }) {
    const { session, active } = data.props;
    if (!session) return null;
    return (
        <>
            <div className="heading session-heading">
                <div>
                    <span className="eyebrow">
                        {session.environment.project.name} /{" "}
                        {session.environment.name}
                    </span>
                    <h1>{session.title}</h1>
                </div>
            </div>
            {active && (
                <div role="status" className="notice" data-refresh>
                    Tests are queued or running. Results update automatically; you can keep reviewing.
                </div>
            )}
            <SuiteComparisons data={data} tab={tab} />
        </>
    );
}

export function SessionTabs({
    tab,
    setTab,
}: {
    tab: string;
    setTab: (tab: string) => void;
}) {
    return (
        <div
            className="comparison-tabs"
            role="tablist"
            aria-label="Comparison views"
        >
            {[
                ["overview", "Overview"],
                ["videos", "Videos"],
                ["dev", "Dev details"],
            ].map(([value, label]) => (
                <button
                    type="button"
                    role="tab"
                    key={value}
                    id={`tab-${value}`}
                    aria-controls={`panel-${value}`}
                    aria-selected={tab === value}
                    onKeyDown={(event) => {
                        const tabs = Array.from(
                            event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                                '[role="tab"]',
                            ),
                        );
                        const index = tabs.indexOf(event.currentTarget);
                        const next =
                            event.key === "ArrowRight"
                                ? (index + 1) % tabs.length
                                : event.key === "ArrowLeft"
                                  ? (index + tabs.length - 1) % tabs.length
                                  : event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? tabs.length - 1
                                      : -1;
                        if (next >= 0) {
                            event.preventDefault();
                            tabs[next].focus();
                            tabs[next].click();
                        }
                    }}
                    tabIndex={tab === value ? 0 : -1}
                    onClick={() => {
                        if (tab === value) return;
                        setTab(value);
                        const url = new URL(location.href);
                        url.searchParams.set("tab", value);
                        history.pushState(null, "", url);
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
