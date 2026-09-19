import { useState, type ReactNode } from "react";
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
    return (
        <form method="post" action={action}>
            <input type="hidden" name="_token" value={csrf} />
            {children}
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
    const env = props.environments?.find((e) => String(e.id) === environmentId);
    if (page === "project")
        return (
            <div className="form-card">
                <h1>Bring your existing project.</h1>
                <p>
                    Connect a local Git repository to its running environment.
                </p>
                <Form action="/projects" csrf={csrf}>
                    {field("Project name", "name", "", true)}
                    {field("Repository directory", "repository_path", "", true)}
                    {field(
                        "Playwright config path · Optional · relative to the repository",
                        "playwright_config",
                    )}
                    <p>Saved for future test execution.</p>
                    <button className="primary">Connect project</button>
                </Form>
            </div>
        );
    if (page === "environment")
        return (
            <div className="form-card">
                <span className="eyebrow">{props.project?.name}</span>
                <h1>Where is your app running?</h1>
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
                    {field("Ready selector · Optional", "ready_selector")}
                    <label>
                        Browser execution
                        <select
                            aria-label="Browser execution"
                            name="runner_mode"
                            defaultValue={value("runner_mode", "local")}
                        >
                            <option value="local">
                                Local Playwright browser
                            </option>
                            <option value="docker">
                                Playwright container on an existing Docker
                                network
                            </option>
                        </select>
                    </label>
                    {field(
                        "Docker network · Required for Docker execution",
                        "docker_network",
                    )}
                    <p>
                        Use a URL reachable on the selected network. Your
                        application must already be running.
                    </p>
                    <label>
                        Capture profile
                        <select
                            aria-label="Capture profile"
                            name="profile"
                            defaultValue={value("profile", "live")}
                        >
                            <option value="live">
                                Real page state · no API mocks
                            </option>
                            <option value="resume">
                                Personal site · simulated resume access
                            </option>
                        </select>
                    </label>
                    <label>
                        Additional allowed origins · One per line
                        <textarea
                            name="allowed_origins"
                            rows={3}
                            defaultValue={value("allowed_origins")}
                        />
                    </label>
                    <button className="primary">Save environment</button>
                </Form>
            </div>
        );
    const scenarios =
        env?.profile === "resume"
            ? {
                  guest: "Signed out",
                  pending: "Pending",
                  approved: "Approved",
                  denied: "Denied",
                  unavailable: "Service unavailable",
              }
            : { live: "Real page state" };
    return (
        <div className="form-card">
            <h1>What are you changing?</h1>
            {!env ? (
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
                            onChange={(e) => setEnvironmentId(e.target.value)}
                        >
                            {props.environments?.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.project.name} / {e.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    {field("Page path", "path", "/resume", true)}
                    <fieldset>
                        <legend>Viewports</legend>
                        {Object.entries({
                            desktop: "Desktop · 1440px",
                            mobile: "Mobile · 390px",
                        }).map(([key, label]) => (
                            <label className="choice" key={key}>
                                <input
                                    type="checkbox"
                                    name="devices[]"
                                    value={key}
                                    defaultChecked={
                                        old.devices
                                            ? old.devices.includes(key)
                                            : true
                                    }
                                />
                                {label}
                            </label>
                        ))}
                    </fieldset>
                    <fieldset key={environmentId}>
                        <legend>Visitor states</legend>
                        {Object.entries(scenarios).map(([key, label]) => (
                            <label className="choice" key={key}>
                                <input
                                    type="checkbox"
                                    name="scenarios[]"
                                    value={key}
                                    defaultChecked={
                                        old.scenarios
                                            ? old.scenarios.includes(key)
                                            : [
                                                  "live",
                                                  "guest",
                                                  "pending",
                                                  "approved",
                                              ].includes(key)
                                    }
                                />
                                {label}
                            </label>
                        ))}
                    </fieldset>
                    <p>
                        Settings are frozen for this session. Successful
                        baselines cannot be overwritten.
                    </p>
                    <button className="primary">Create session</button>
                </Form>
            )}
        </div>
    );
}
