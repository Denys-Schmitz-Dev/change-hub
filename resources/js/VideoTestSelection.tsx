import { useState } from "react";
import { Form } from "./forms";
import type { TestSuite } from "./types";

export function VideoTestSelection({ suite, csrf }: { suite: TestSuite; csrf: string }) {
    const tests = [...new Map([
        ...suite.runs.flatMap(run => run.report?.tests ?? []),
        ...(suite.test_catalog ?? []),
    ].map(test => [test.key, test])).values()];
    const files = [...new Set(tests.map(test => test.file ?? test.title.split(" › ")[0]))].sort();
    const [selected, setSelected] = useState(() => new Set(suite.selected_tests ?? tests.map(test => test.key)));
    const allSelected = tests.every(test => selected.has(test.key));
    function toggle(keys: string[], checked: boolean) {
        setSelected(current => {
            const next = new Set(current);
            keys.forEach(key => checked ? next.add(key) : next.delete(key));
            return next;
        });
    }
    return <section className="video-test-selection" aria-label="Video comparison selection">
        <div className="heading"><h4>Video comparisons</h4><Form action={`/suites/${suite.id}/tests`} csrf={csrf}><button>Refresh test list</button></Form></div>
        {!tests.length ? <p>No tests listed.</p> : <Form action={`/suites/${suite.id}/video`} csrf={csrf}>
            <input type="hidden" name="mode" value={allSelected ? "all" : "selected"} />
            {!allSelected && [...selected].map(key => <input type="hidden" name="selected_tests[]" value={key} key={key} />)}
            {files.map(file => {
                const children = tests.filter(test => (test.file ?? test.title.split(" › ")[0]) === file);
                const count = children.filter(test => selected.has(test.key)).length;
                return <details className="test-file" key={file} open>
                    <summary><label className="test-choice"><input type="checkbox" aria-label={`Videos for file ${file}`} checked={count === children.length} ref={input => { if (input) input.indeterminate = count > 0 && count < children.length; }} onChange={event => toggle(children.map(test => test.key), event.target.checked)} /><code>{file}</code></label><span className="badge">{count}/{children.length}</span></summary>
                    <div className="test-children">{children.map(test => <label className="test-choice" key={test.key}>
                        <input type="checkbox" aria-label={`Video for ${test.title} (${test.project || "Default"})`} checked={selected.has(test.key)} onChange={event => toggle([test.key], event.target.checked)} />
                        <span>{test.title.split(" › ").slice(1).join(" › ") || test.title}<small>{test.project || "Default"}</small></span>
                    </label>)}</div>
                </details>;
            })}
            <button className="primary">Apply video selection</button>
        </Form>}
    </section>;
}
