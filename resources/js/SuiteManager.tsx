import { Fragment, useState } from "react";
import { TestPicker } from "./TestPicker";
import { Form } from "./forms";
import { VideoTestSelection } from "./VideoTestSelection";
import type { Payload, TestSuite } from "./types";

function SuiteSettings({
    suite,
    data,
    busy,
}: {
    suite: TestSuite;
    data: Payload;
    busy: boolean;
}) {
    const [removing, setRemoving] = useState(false);
    const editing = String(data.old.suite_id ?? "") === String(suite.id);
    const value = (key: string, fallback: string) =>
        editing && typeof data.old[key] === "string"
            ? (data.old[key] as string)
            : fallback;
    return (
        <div className="suite-settings">
            {!!suite.test_selection?.length && (
                <p className="notice">
                    This suite runs {suite.test_selection.length} picked tests.
                    Changing its config or filter resets the picked selection.
                </p>
            )}
            <details open={editing || undefined}>
                <summary>Edit suite</summary>
                <Form action={`/suites/${suite.id}`} csrf={data.csrf}>
                    <input type="hidden" name="_method" value="PATCH" />
                    <input type="hidden" name="suite_id" value={suite.id} />
                    <fieldset disabled={busy}>
                        <label>
                            Suite name
                            <input
                                name="name"
                                required
                                maxLength={120}
                                defaultValue={value("name", suite.name)}
                            />
                        </label>
                        <label>
                            Suite config path
                            <input
                                name="config"
                                required
                                maxLength={500}
                                defaultValue={value("config", suite.config)}
                            />
                        </label>
                        <label>
                            Test title filter (optional regex)
                            <input
                                name="grep"
                                maxLength={200}
                                defaultValue={value("grep", suite.grep ?? "")}
                            />
                        </label>
                        {!!suite.runs.length && (
                            <label className="test-choice">
                                <input
                                    type="checkbox"
                                    name="reset_history"
                                    value="1"
                                />
                                If I change the config or filter, delete this
                                suite’s captures. The session baseline stays
                                unchanged. Renaming keeps captures.
                            </label>
                        )}
                        <button className="primary">Save suite</button>
                    </fieldset>
                </Form>
            </details>
            {removing ? (
                <div className="notice">
                    <p>
                        Remove {suite.name} and all its captures from this
                        session? The session baseline is kept.
                    </p>
                    <div className="actions">
                        <Form action={`/suites/${suite.id}`} csrf={data.csrf}>
                            <input
                                type="hidden"
                                name="_method"
                                value="DELETE"
                            />
                            <button disabled={busy}>Confirm removal</button>
                        </Form>
                        <button
                            type="button"
                            onClick={() => setRemoving(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRemoving(true)}
                >
                    Remove suite
                </button>
            )}
            <VideoTestSelection suite={suite} csrf={data.csrf} />
        </div>
    );
}

export function SuiteManager({
    data,
    selectedId,
}: {
    data: Payload;
    selectedId?: number;
}) {
    const session = data.props.session!;
    const [picking, setPicking] = useState(false);
    const [expanded, setExpanded] = useState<Set<number>>(
        () => new Set(data.old.suite_id ? [Number(data.old.suite_id)] : []),
    );
    return (
        <section className="suite-manager" aria-label="Playwright suites">
            {picking && (
                <TestPicker data={data} onClose={() => setPicking(false)} />
            )}
            <div className="recent-heading">
                <div>
                    <h2>Playwright suites</h2>
                    <p>
                        {session.suites.length} connected · Expand a suite to
                        manage its settings and test files.
                    </p>
                </div>
                <button
                    type="button"
                    className="primary"
                    disabled={!!data.props.active}
                    onClick={() => setPicking(true)}
                >
                    Add tests
                </button>
            </div>
            {!!session.suites.length && (
                <div className="suite-table-scroll">
                    <table className="suite-table">
                        <thead>
                            <tr>
                                <th>Suite / config</th>
                                <th>Latest run</th>
                                <th>Review</th>
                            </tr>
                        </thead>
                        <tbody>
                            {session.suites.map((suite) => (
                                <Fragment key={suite.id}>
                                    <tr
                                        aria-current={
                                            suite.id === selectedId
                                                ? "true"
                                                : undefined
                                        }
                                    >
                                        <th scope="row">
                                            <button
                                                type="button"
                                                aria-expanded={expanded.has(
                                                    suite.id,
                                                )}
                                                onClick={() =>
                                                    setExpanded((current) => {
                                                        const next = new Set(
                                                            current,
                                                        );
                                                        if (next.has(suite.id))
                                                            next.delete(
                                                                suite.id,
                                                            );
                                                        else next.add(suite.id);
                                                        return next;
                                                    })
                                                }
                                            >
                                                {expanded.has(suite.id)
                                                    ? "▾"
                                                    : "▸"}{" "}
                                                {suite.name}
                                            </button>
                                            <code>{suite.config}</code>
                                        </th>
                                        <td>
                                            {suite.runs.at(-1)?.status ??
                                                "Not captured"}
                                            <small>
                                                {
                                                    suite.runs.at(-1)?.report
                                                        ?.outcome
                                                }
                                            </small>
                                        </td>
                                        <td>
                                            <a
                                                className="button"
                                                href={`?tab=videos&suite=${suite.id}`}
                                            >
                                                See videos
                                            </a>
                                        </td>
                                    </tr>
                                    {expanded.has(suite.id) && (
                                        <tr>
                                            <td colSpan={3}>
                                                <SuiteSettings
                                                    suite={suite}
                                                    data={data}
                                                    busy={!!data.props.active}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <details
                className="add-suite"
                open={
                    (data.errors.length > 0 &&
                        !data.old.suite_id &&
                        data.old.config !== undefined) ||
                    undefined
                }
            >
                <summary>Add a Playwright suite</summary>
                <p>
                    Advanced: connect a full config or enter a regex filter. Use
                    Add tests above to choose tests by name.
                </p>
                <Form
                    action={`/sessions/${session.id}/suites`}
                    csrf={data.csrf}
                >
                    <label>
                        Suite name
                        <input
                            name="name"
                            required
                            maxLength={120}
                            defaultValue={
                                !data.old.suite_id
                                    ? String(data.old.name ?? "")
                                    : ""
                            }
                        />
                    </label>
                    <label>
                        Suite config path
                        <input
                            name="config"
                            required
                            defaultValue={
                                !data.old.suite_id
                                    ? String(
                                          data.old.config ??
                                              session.environment.project
                                                  .playwright_config ??
                                              "",
                                      )
                                    : (session.environment.project
                                          .playwright_config ?? "")
                            }
                        />
                    </label>
                    <label>
                        Test title filter (optional regex)
                        <input
                            name="grep"
                            maxLength={200}
                            defaultValue={
                                !data.old.suite_id
                                    ? String(data.old.grep ?? "")
                                    : ""
                            }
                        />
                    </label>
                    <button className="primary" disabled={!!data.props.active}>
                        Add suite
                    </button>
                </Form>
            </details>
        </section>
    );
}
