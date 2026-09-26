import { useContext, useState, type ReactNode } from "react";
import { LiveData, readPayload } from "./live-data";
import type { Payload } from "./types";

export function Form({
    action,
    csrf,
    children,
}: {
    action: string;
    csrf: string;
    children: ReactNode;
}) {
    const live = useContext(LiveData);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    return (
        <form
            method="post"
            action={action}
            aria-busy={pending}
            onSubmit={async (event) => {
                if (!live) return;
                event.preventDefault();
                if (live.pending) return;
                const form = event.currentTarget;
                const body = new FormData(form);
                const submitter = (event.nativeEvent as SubmitEvent).submitter;
                setMessage(
                    submitter?.textContent?.includes("Refresh test list")
                        ? "Refreshing test list…"
                        : "Saving…",
                );
                setPending(true);
                live.setPending(true);
                setError("");
                try {
                    const response = await fetch(action, {
                        method: "POST",
                        body,
                        headers: { Accept: "text/html" },
                    });
                    const data = await readPayload(response);
                    if (
                        response.redirected &&
                        new URL(response.url).pathname !== location.pathname
                    ) {
                        location.assign(response.url);
                        return;
                    }
                    live.update(data);
                    setMessage(
                        data.errors.length
                            ? "Please correct the highlighted errors."
                            : "Updated.",
                    );
                } catch (error) {
                    setError(
                        error instanceof Error
                            ? `${error.message} Your current view is preserved; try again.`
                            : "Unable to save. Please try again.",
                    );
                    setMessage("");
                } finally {
                    setPending(false);
                    live.setPending(false);
                }
            }}
        >
            <input type="hidden" name="_token" value={csrf} />
            <fieldset
                className="form-fields"
                disabled={pending || !!live?.pending}
            >
                {children}
            </fieldset>
            {message && (
                <p className="form-feedback" role="status">
                    {message}
                </p>
            )}
            {error && (
                <p className="notice error" role="alert">
                    {error}
                </p>
            )}
        </form>
    );
}

export function Forms({ data }: { data: Payload }) {
    const { page, props, csrf, old } = data;
    const value = (name: string, fallback = "") =>
        typeof old[name] === "string" ? (old[name] as string) : fallback;
    const field = (
        label: string,
        name: string,
        fallback = "",
        required = false,
        type = "text",
    ) => (
        <label>
            {label}
            <input
                name={name}
                defaultValue={value(name, fallback)}
                required={required}
                type={type}
            />
        </label>
    );
    const [environmentId, setEnvironmentId] = useState(
        value(
            "environment_id",
            new URLSearchParams(location.search).get("environment") ??
                String(props.environments?.[0]?.id ?? ""),
        ),
    );
    if (page === "project")
        return (
            <div className="form-card">
                <h1>Connect project</h1>
                <Form action="/projects" csrf={csrf}>
                    {field("Project name", "name", "", true)}
                    {field("Repository directory", "repository_path", "", true)}
                    <fieldset>
                        <legend>End-to-end tests</legend>
                        {field(
                            "Playwright config path",
                            "playwright_config",
                            "frontend/playwright.config.ts",
                            true,
                        )}
                        {field(
                            "Default suite name",
                            "suite_name",
                            "E2E tests",
                            true,
                        )}
                        {field(
                            "Test title filter (optional regex)",
                            "test_filter",
                        )}
                    </fieldset>
                    <button className="primary">Connect project</button>
                </Form>
            </div>
        );
    if (page === "environment")
        return (
            <div className="form-card">
                <h1>Test environment</h1>
                <Form
                    action={`/projects/${props.project!.id}/environments`}
                    csrf={csrf}
                >
                    {field(
                        "Environment name",
                        "name",
                        "Local development",
                        true,
                    )}
                    {field(
                        "Runner-visible URL",
                        "base_url",
                        "http://127.0.0.1:5175",
                        true,
                        "url",
                    )}
                    <input type="hidden" name="runner_mode" value="local" />
                    <input type="hidden" name="profile" value="live" />
                    <button className="primary">Save environment</button>
                </Form>
            </div>
        );
    return (
        <div className="form-card">
            <h1>New change session</h1>
            {!props.environments?.length ? (
                <a href="/projects/create">Connect a project first</a>
            ) : (
                <Form action="/sessions" csrf={csrf}>
                    {field("Session title", "title", "", true)}
                    <label>
                        Environment
                        <select
                            aria-label="Environment"
                            name="environment_id"
                            value={environmentId}
                            onChange={(event) =>
                                setEnvironmentId(event.target.value)
                            }
                        >
                            {props.environments.map((environment) => (
                                <option
                                    key={environment.id}
                                    value={environment.id}
                                >
                                    {environment.project.name} /{" "}
                                    {environment.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="primary">Create session</button>
                </Form>
            )}
        </div>
    );
}
