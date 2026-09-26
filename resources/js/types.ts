export interface Artifact {
    id: number;
    name: string;
    sha256: string;
}
export interface Frame {
    id: number;
    key: string;
    error: string | null;
    artifacts: Artifact[];
    events: unknown;
}
export interface Run {
    id: number;
    phase: string;
    status: string;
    error: string | null;
    created_at: string;
    metadata: { contracts?: ContractSnapshot } | null;
    views: Frame[];
}
export interface Project {
    id: number;
    name: string;
    repository_path: string;
    playwright_config?: string;
    environments: Environment[];
}
export interface Environment {
    id: number;
    name: string;
    base_url: string;
    runner_mode: string;
    profile: string;
    project: Project;
}
export interface Session {
    baseline_available?: boolean;
    baseline?: { suite_ids: number[]; runs: (SuiteRun & { config: string; test_suite_id: number })[] } | null;
    id: number;
    title: string;
    environment: Environment;
    profile: { baseURL: string; path: string; adapter: string };
    runs: Run[];
    suites: TestSuite[];
}
export interface Props {
    projects?: Project[];
    sessions?: Session[];
    project?: Project;
    environments?: Environment[];
    session?: Session;
    before?: Run | null;
    after?: Run | null;
    afterRuns?: Run[];
    keys?: string[];
    key?: string;
    left?: Frame | null;
    right?: Frame | null;
    active?: boolean;
    changes?: Record<string, { added: unknown[]; removed: unknown[] }>;
}
export interface Payload {
    page: string;
    props: Props;
    csrf: string;
    old: Record<string, string | string[]>;
    errors: string[];
    message?: string;
}

export interface SuiteAttachment {
    key: string;
    name: string;
    file: string;
    contentType: string;
}
export interface SuiteCase {
    coveredFiles?: string[];
    file?: string;
    diagnostics?: { console: string[]; network: string[]; warnings: string[] };
    key: string;
    title: string;
    project: string;
    outcome: string;
    expectedStatus: string;
    duration: number;
    attempts: {
        status: string;
        retry: number;
        duration: number;
        errors: string[];
    }[];
    attachments: SuiteAttachment[];
}
export interface SuiteRun {
    config?: string;
    artifact_base?: string;
    capture_video: boolean;
    id: number;
    phase: string;
    status: string;
    error: string | null;
    created_at: string;
    report: {
        contracts?: ContractSnapshot;
        outcome: string;
        tests: SuiteCase[];
        errors?: string[];
        sourceBefore?: { commit: string; fingerprint: string };
        sourceAfter?: { commit: string; fingerprint: string };
    } | null;
}
export interface TestSuite {
    test_selection?: { key: string; file: string; title: string; project: string; listEntry: string }[] | null;
    selected_tests: string[] | null;
    test_catalog: Pick<SuiteCase, "key" | "file" | "title" | "project">[] | null;
    capture_video: boolean;
    id: number;
    name: string;
    config: string;
    grep: string | null;
    runs: SuiteRun[];
}

export type ContractCategory =
    "api" | "routes" | "ui" | "state" | "data" | "dependencies";
export interface ContractEntry {
    key: string;
    file: string;
    line: number;
    label: string;
    signature: string;
    hash: string;
    truncated?: boolean;
}
export interface ContractSnapshot {
    version: number;
    capturedAt: string;
    scannedFiles: number;
    warnings: string[];
    categories: Record<ContractCategory, ContractEntry[]>;
}
