import { createRoot } from "react-dom/client";
import type { Payload, Props } from "./types";
import { Forms } from "./forms";
import { Comparison } from "./Comparison";
import "../css/hub.css";
function Home({ projects = [], sessions = [] }: Props) {
    return (
        <>
            <div className="heading">
                <div>
                    <span className="eyebrow">YOUR VERIFICATION WORKSPACE</span>
                    <h1>Build with confidence. Review with evidence.</h1>
                    <p>
                        Connect a running environment, save a baseline, and
                        compare your next change.
                    </p>
                </div>
                <a className="button primary" href="/projects/create">
                    Connect a project ↗
                </a>
            </div>
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
                    </article>
                ))}
            </div>
            <h2>Change sessions</h2>
            <div className="sessions">
                {sessions.map((s) => (
                    <a
                        className="session-row"
                        href={`/sessions/${s.id}`}
                        key={s.id}
                    >
                        <div>
                            <strong>{s.title}</strong>
                            <p>
                                {s.environment.project.name} /{" "}
                                {s.environment.name} · {s.profile.path}
                            </p>
                        </div>
                        <span className="badge">
                            {s.runs.at(-1)?.status ?? "Ready for baseline"}
                        </span>
                    </a>
                ))}
                {sessions.length === 0 && (
                    <p>
                        Your saved before and after captures will appear here.
                    </p>
                )}
            </div>
        </>
    );
}
function App({ data }: { data: Payload }) {
    return (
        <>
            <aside>
                <a className="brand" href="/">
                    <b>↔</b> Change Hub <small>LOCAL</small>
                </a>
                <div className="project-mark">
                    <span className="eyebrow">YOUR DEVELOPMENT WORKSPACE</span>
                    <strong>Before. After. Evidence.</strong>
                    <p>Changes, tests, and runtime evidence</p>
                </div>
                <nav>
                    <a href="/" aria-current={data.page === "home" ? "page" : undefined}>Projects & sessions</a>
                    <a href="/projects/create">+ Connect a project</a>
                    <a href="/sessions/create">+ New change session</a>
                </nav>
                <p className="aside-note">
                    Attach to your existing environment.
                    <br />
                    Keep the evidence in this workspace.
                </p>
            </aside>
            <div className="workspace">
                <header>
                    <span>
                        Workspace / {data.props.session?.title ?? "Change Hub"}
                    </span>
                    <span className="badge">LOCAL ONLY</span>
                </header>
                <main>
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
                        <Home {...data.props} />
                    ) : data.page === "session" ? (
                        <Comparison data={data} />
                    ) : (
                        <Forms data={data} />
                    )}
                </main>
            </div>
        </>
    );
}
const data: Payload = JSON.parse(
    document.getElementById("hub-data")!.textContent!,
);
createRoot(document.getElementById("root")!).render(<App data={data} />);
