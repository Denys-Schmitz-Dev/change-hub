import { Fragment, useState } from "react";
import type { SuiteCase } from "./types";

type Test = Pick<SuiteCase, "key" | "title" | "file" | "project">;
type Node = {
    label: string;
    kind: string;
    children: Map<string, Node>;
    tests: Test[];
};

export function TestHierarchy({
    tests,
    selected,
    onToggle,
}: {
    tests: Test[];
    selected: Set<string>;
    onToggle: (keys: string[], checked: boolean) => void;
}) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const root: Node = { label: "", kind: "", children: new Map(), tests: [] };
    for (const test of tests) {
        const parts = test.title.split(" › ");
        const file =
            test.file ?? (parts.length > 1 ? parts[0] : "Unspecified file");
        if (parts[0] === file || parts[0] === file.split("/").at(-1))
            parts.shift();
        const groups = [file, ...parts.slice(0, -1)];
        let node = root;
        groups.forEach((label, index) => {
            if (!node.children.has(label))
                node.children.set(label, {
                    label,
                    kind: index === 0 ? "File" : "Suite",
                    children: new Map(),
                    tests: [],
                });
            node = node.children.get(label)!;
        });
        node.tests.push(test);
    }
    const descendants = (node: Node): Test[] => [
        ...node.tests,
        ...[...node.children.values()].flatMap(descendants),
    ];
    function rows(node: Node, path: string[] = [], depth = 0): React.ReactNode {
        return (
            <>
                {[...node.children.values()].map((child) => {
                    const nextPath = [...path, child.label];
                    const key = JSON.stringify(nextPath);
                    const children = descendants(child);
                    const count = children.filter((test) =>
                        selected.has(test.key),
                    ).length;
                    const open = expanded.has(key);
                    return (
                        <Fragment key={key}>
                            <tr className="hierarchy-group">
                                <th
                                    scope="row"
                                    style={{ paddingLeft: 12 + depth * 20 }}
                                >
                                    <button
                                        type="button"
                                        aria-expanded={open}
                                        onClick={() =>
                                            setExpanded((current) => {
                                                const next = new Set(current);
                                                if (open) next.delete(key);
                                                else next.add(key);
                                                return next;
                                            })
                                        }
                                    >
                                        {open ? "▾" : "▸"} {child.label}
                                    </button>
                                </th>
                                <td>
                                    {child.kind} · {children.length}{" "}
                                    {children.length === 1 ? "test" : "tests"}
                                </td>
                                <td>
                                    <label className="test-choice">
                                        <input
                                            type="checkbox"
                                            aria-label={`Videos for ${child.kind.toLowerCase()} ${child.label}`}
                                            checked={count === children.length}
                                            ref={(input) => {
                                                if (input)
                                                    input.indeterminate =
                                                        count > 0 &&
                                                        count < children.length;
                                            }}
                                            onChange={(event) =>
                                                onToggle(
                                                    children.map(
                                                        (test) => test.key,
                                                    ),
                                                    event.target.checked,
                                                )
                                            }
                                        />
                                        {count}/{children.length}
                                    </label>
                                </td>
                            </tr>
                            {open && rows(child, nextPath, depth + 1)}
                        </Fragment>
                    );
                })}
                {node.tests.map((test) => (
                    <tr key={test.key}>
                        <th
                            scope="row"
                            style={{ paddingLeft: 12 + depth * 20 }}
                        >
                            {test.title.split(" › ").at(-1)}
                        </th>
                        <td>{test.project || "Default"}</td>
                        <td>
                            <input
                                type="checkbox"
                                aria-label={`Video for ${test.title} (${test.project || "Default"})`}
                                checked={selected.has(test.key)}
                                onChange={(event) =>
                                    onToggle([test.key], event.target.checked)
                                }
                            />
                        </td>
                    </tr>
                ))}
            </>
        );
    }
    return (
        <div className="suite-table-scroll">
            <table className="suite-table">
                <caption>Test files and suites</caption>
                <thead>
                    <tr>
                        <th>File / suite / test</th>
                        <th>Details</th>
                        <th>Videos</th>
                    </tr>
                </thead>
                <tbody>{rows(root)}</tbody>
            </table>
        </div>
    );
}
