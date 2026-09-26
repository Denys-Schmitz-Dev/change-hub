import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Payload, Props } from "./types";
import { LiveData, readPayload } from "./live-data";
import { Forms } from "./forms";
import { Comparison, SessionTabs } from "./Comparison";
import "../css/hub.css";
function sessionStatus(session: NonNullable<Props["sessions"]>[number]) {
    const runs = (session.suites ?? []).flatMap((suite) =>
        suite.runs.at(-1) ? [suite.runs.at(-1)!] : [],
    );
    if (runs.some((run) => run.status === "running")) return "Tests running";
    if (runs.some((run) => run.status === "queued")) return "Tests queued";
    if (runs.some((run) => run.status === "failed"))
        return "Run needs attention";
    if (runs.some((run) => run.phase === "after" && run.status === "complete"))
        return "Ready to review";
    if (runs.some((run) => run.phase === "before" && run.status === "complete"))
        return "Baseline captured";
    if (session.baseline_available) return "Baseline captured";
    return session.runs.at(-1)?.status ?? "Ready for baseline";
}
function DeleteControl({ action, csrf, label }: { action: string; csrf: string; label: string }) {
    const [confirming, setConfirming] = useState(false);
    return confirming ? (
        <div className="delete-confirmation">
            <span>Delete permanently?</span>
            <form method="post" action={action}>
                <input type="hidden" name="_token" value={csrf} />
                <input type="hidden" name="_method" value="DELETE" />
                <button className="danger">Yes, delete</button>
            </form>
            <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
    ) : (
        <button type="button" className="danger-link" onClick={() => setConfirming(true)}>{label}</button>
    );
}
function ProjectsAndSessions({ projects = [], sessions = [], csrf }: Props & { csrf: string }) {
    const [sessionQuery, setSessionQuery] = useState("");
    const projectId = new URLSearchParams(location.search).get("project");
    const project = projects.find(
        (project) => String(project.id) === projectId,
    );
    const projectSessions =
        projectId === null
            ? sessions
            : sessions.filter(
                  (session) =>
                      String(session.environment.project.id) === projectId,
              );

    const query = sessionQuery.trim().toLowerCase();
    const visibleSessions = projectSessions.filter((session) =>
        `${session.title} ${session.environment.project.name} ${session.environment.name} ${session.profile.path}`
            .toLowerCase()
            .includes(query),
    );

    return (
        <>
            <div className="heading">
                <div>
                    <span className="eyebrow">YOUR VERIFICATION WORKSPACE</span>
                    <h1>
                        {projectId === null
                            ? "Build with confidence. Review with evidence."
                            : project
                              ? `${project.name} change sessions`
                              : "Project not found"}
                    </h1>
                    <p>
                        {projectId === null
                            ? "Connect a running environment, save a baseline, and compare your next change."
                            : project
                              ? "Review the change sessions for this project."
                              : "This project is no longer available."}
                    </p>
                </div>
                {projectId === null ? (
                    <a className="button primary" href="/projects/create">
                        Connect a project ↗
                    </a>
                ) : (
                    <a className="button" href="/?view=projects">
                        All projects and sessions
                    </a>
                )}
            </div>
            {projectId === null && (
                <>
                    <h2>Connected projects</h2>
                    <div className="cards">
                        {projects.length === 0 && (
                            <article className="card">
                                <h2>Start with a project you already run.</h2>
                            </article>
                        )}
                        {projects.map((p) => (
                            <article className="card" key={p.id}>
                                <h2>{p.name}</h2>
                                <code>{p.repository_path}</code>
                                {p.environments.map((e) => (
                                    <div className="environment-row" key={e.id}>
                                        <div>
                                            <strong>{e.name}</strong>
                                            <p>
                                                {e.base_url} · {e.runner_mode}
                                            </p>
                                            <small>
                                                {e.profile === "resume"
                                                    ? "Simulated resume states"
                                                    : "Real page state"}
                                            </small>
                                        </div>
                                        <a
                                            className="button"
                                            href={`/sessions/create?environment=${e.id}`}
                                        >
                                            New session
                                        </a>
                                    </div>
                                ))}
                                <a
                                    className="text-link"
                                    href={`/projects/${p.id}/environments/create`}
                                >
                                    + Add environment
                                </a>
                                <DeleteControl action={`/projects/${p.id}`} csrf={csrf} label="Delete project" />
                            </article>
                        ))}
                    </div>
                </>
            )}
            <h2>Change sessions</h2>
            {(projectId === null || project) && (
                <div className="filters">
                    <label>
                        Find a change session
                        <input
                            type="search"
                            value={sessionQuery}
                            onChange={(event) =>
                                setSessionQuery(event.target.value)
                            }
                            placeholder="Session, project, or environment"
                        />
                    </label>
                    {sessionQuery && (
                        <button
                            type="button"
                            onClick={() => setSessionQuery("")}
                        >
                            Clear session search
                        </button>
                    )}
                    <span role="status">
                        {visibleSessions.length} of {projectSessions.length}{" "}
                        sessions
                    </span>
                </div>
            )}
            <div className="sessions">
                {visibleSessions.map((s) => (
                    <div
                        className="session-row"
                        key={s.id}
                    >
                        <div>
                            <strong><a href={`/sessions/${s.id}`}>{s.title}</a></strong>
                            <p>
                                {s.environment.project.name} /{" "}
                                {s.environment.name} · {s.profile.path}
                            </p>
                        </div>
                        <div className="session-row-actions">
                            <span className="badge">{sessionStatus(s)}</span>
                            <DeleteControl action={`/sessions/${s.id}`} csrf={csrf} label="Delete session" />
                        </div>
                    </div>
                ))}
                {visibleSessions.length === 0 && (
                    <p>
                        {query
                            ? "No change sessions match your search."
                            : projectId === null
                              ? "Your saved before and after captures will appear here."
                              : project
                                ? "No change sessions for this project yet."
                                : "Choose a project from the projects list."}
                    </p>
                )}
            </div>
        </>
    );
}
function Home({ projects = [], sessions = [] }: Props) {
    const recentSessions = [...sessions]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);
    const recentProjects = [...projects]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);
    return (
        <>
            <div className="heading">
                <div>
                    <span className="eyebrow">YOUR DEVELOPMENT WORKSPACE</span>
                    <h1>Home</h1>
                    <p>Start a change session or connect a project.</p>
                </div>
            </div>
            <div className="cards home-actions">
                <a className="card action-card" href="/sessions/create">
                    <h2>New session →</h2>
                    <p>
                        Review a change with tests and before-and-after
                        evidence.
                    </p>
                </a>
                <a className="card action-card" href="/projects/create">
                    <h2>Connect a project →</h2>
                    <p>Connect your repository and running environment.</p>
                </a>
            </div>
            <div className="recent-heading">
                <h2>Recent projects</h2>
                <a className="text-link" href="/?view=projects">
                    View all projects and sessions →
                </a>
            </div>
            {recentProjects.length === 0 ? (
                <p>
                    No projects connected yet. Connect a project to get started.
                </p>
            ) : (
                <div className="recent-projects">
                    <table>
                        <caption>Last five connected projects</caption>
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Repository</th>
                                <th>Environments</th>
                                <th>Sessions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentProjects.map((project) => (
                                <tr key={project.id}>
                                    <th scope="row">{project.name}</th>
                                    <td>
                                        <code>{project.repository_path}</code>
                                    </td>
                                    <td>
                                        {project.environments.map(
                                            (environment) => (
                                                <a
                                                    className="button"
                                                    key={environment.id}
                                                    href={
                                                        "/sessions/create?environment=" +
                                                        environment.id
                                                    }
                                                >
                                                    New session ·{" "}
                                                    {environment.name}
                                                </a>
                                            ),
                                        )}
                                        <a
                                            className="text-link"
                                            href={
                                                "/projects/" +
                                                project.id +
                                                "/environments/create"
                                            }
                                        >
                                            + Add environment
                                        </a>
                                    </td>
                                    <td>
                                        <a
                                            className="button"
                                            href={`/?view=projects&project=${project.id}`}
                                        >
                                            View change sessions
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="recent-heading">
                <h2>Recent change sessions</h2>
                <a className="text-link" href="/?view=projects">
                    View all sessions →
                </a>
            </div>
            {recentSessions.length === 0 ? (
                <p>
                    No change sessions yet. Create a session to start reviewing
                    a change.
                </p>
            ) : (
                <div className="recent-projects">
                    <table>
                        <caption>Last five change sessions</caption>
                        <thead>
                            <tr>
                                <th>Session</th>
                                <th>Project</th>
                                <th>Environment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentSessions.map((session) => (
                                <tr key={session.id}>
                                    <th scope="row">
                                        <a href={"/sessions/" + session.id}>
                                            {session.title}
                                        </a>
                                    </th>
                                    <td>{session.environment.project.name}</td>
                                    <td>{session.environment.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
function reviewTabFromUrl() {
    const tab = new URLSearchParams(location.search).get("tab");
    return tab && ["overview", "videos", "dev"].includes(tab)
        ? tab
        : "overview";
}
function App({ data: initialData }: { data: Payload }) {
    const [data, setData] = useState(initialData);
    const [pending, setPending] = useState(false);
    const [refreshError, setRefreshError] = useState("");
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        if (!data.props.active || pending) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const refresh = async () => {
            try {
                const response = await fetch(location.href, {
                    signal: controller.signal,
                    headers: { Accept: "text/html" },
                    cache: "no-store",
                });
                const next = await readPayload(response);
                if (controller.signal.aborted) return;
                setData(next);
                setRefreshError("");
                if (next.props.active) timer = setTimeout(refresh, 2500);
            } catch {
                if (!controller.signal.aborted)
                    setRefreshError(
                        "Live updates paused. Your current evidence is still available.",
                    );
            }
        };
        timer = setTimeout(refresh, 2500);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [data.props.active, pending, retry]);
    const [tab, setTab] = useState(reviewTabFromUrl);
    useEffect(() => {
        const restoreTab = () => setTab(reviewTabFromUrl());
        window.addEventListener("popstate", restoreTab);
        return () => window.removeEventListener("popstate", restoreTab);
    }, []);
    const projectsView =
        data.page === "home" &&
        new URLSearchParams(location.search).get("view") === "projects";
    return (
        <LiveData.Provider value={{ update: setData, pending, setPending }}>
            <header className="topbar">
                <a className="brand" href="/">
                    <b>↔</b> Change Hub
                </a>
                {data.page === "session" ? (
                    <div className="session-navigation">
                        <a className="button back-home" href="/">
                            ← Back to home
                        </a>
                        <SessionTabs tab={tab} setTab={setTab} />
                    </div>
                ) : (
                    <nav aria-label="Workspace">
                        <a
                            href="/"
                            aria-current={
                                data.page === "home" && !projectsView
                                    ? "page"
                                    : undefined
                            }
                        >
                            Home
                        </a>
                        <a
                            href="/?view=projects"
                            aria-current={projectsView ? "page" : undefined}
                        >
                            Projects and sessions
                        </a>
                        <a
                            href="/sessions/create"
                            aria-current={
                                data.page === "session-form"
                                    ? "page"
                                    : undefined
                            }
                        >
                            + New session
                        </a>
                    </nav>
                )}
            </header>
            <div className="workspace">
                <main>
                    {refreshError && (
                        <div className="notice error" role="alert">
                            {refreshError}{" "}
                            <button
                                type="button"
                                onClick={() => {
                                    setRefreshError("");
                                    setRetry((value) => value + 1);
                                }}
                            >
                                Retry live updates
                            </button>
                        </div>
                    )}
                    {data.message && (
                        <div role="status" className="notice">
                            {data.message}
                        </div>
                    )}
                    {data.errors.length > 0 && (
                        <div role="alert" className="notice error">
                            <strong>Please check the following:</strong>
                            <ul>
                                {data.errors.map((e, i) => (
                                    <li key={i}>{e}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {data.page === "home" ? (
                        projectsView ? (
                            <ProjectsAndSessions {...data.props} csrf={data.csrf} />
                        ) : (
                            <Home {...data.props} />
                        )
                    ) : data.page === "session" ? (
                        <Comparison data={data} tab={tab} />
                    ) : (
                        <Forms data={data} />
                    )}
                </main>
            </div>
        </LiveData.Provider>
    );
}
const data: Payload = JSON.parse(
    document.getElementById("hub-data")!.textContent!,
);
createRoot(document.getElementById("root")!).render(<App data={data} />);
