import { useState } from "react";
import { TestHierarchy } from "./TestHierarchy";
import { Form } from "./forms";
import type { TestSuite } from "./types";

export function VideoTestSelection({
    suite,
    csrf,
}: {
    suite: TestSuite;
    csrf: string;
}) {
    const tests = [
        ...new Map(
            [
                ...suite.runs.flatMap((run) => run.report?.tests ?? []),
                ...(suite.test_catalog ?? []),
            ].map((test) => [test.key, test]),
        ).values(),
    ];
    const [selection, setSelected] = useState<Set<string> | null>(
        () => suite.selected_tests === null ? null : new Set(suite.selected_tests),
    );
    const selected = selection ?? new Set(tests.map((test) => test.key));
    const allSelected = tests.every((test) => selected.has(test.key));
    function toggle(keys: string[], checked: boolean) {
        setSelected((current) => {
            const next = new Set(current ?? tests.map((test) => test.key));
            keys.forEach((key) => (checked ? next.add(key) : next.delete(key)));
            return next;
        });
    }
    return (
        <section
            className="video-test-selection"
            aria-label="Video comparison selection"
        >
            <div className="heading">
                <h4>Video comparisons</h4>
                <Form action={`/suites/${suite.id}/tests`} csrf={csrf}>
                    <button>Refresh test list</button>
                </Form>
            </div>
            {!tests.length ? (
                <p>No tests listed.</p>
            ) : (
                <Form action={`/suites/${suite.id}/video`} csrf={csrf}>
                    <input
                        type="hidden"
                        name="mode"
                        value={allSelected ? "all" : "selected"}
                    />
                    {!allSelected &&
                        [...selected].map((key) => (
                            <input
                                type="hidden"
                                name="selected_tests[]"
                                value={key}
                                key={key}
                            />
                        ))}
                    <TestHierarchy
                        tests={tests}
                        selected={selected}
                        onToggle={toggle}
                    />
                    <button className="primary">Apply video selection</button>
                </Form>
            )}
        </section>
    );
}
