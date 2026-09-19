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
    metadata: unknown;
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
    id: number;
    phase: string;
    status: string;
    error: string | null;
    created_at: string;
    report: {
        outcome: string;
        tests: SuiteCase[];
        errors?: string[];
        sourceBefore?: { commit: string; fingerprint: string };
        sourceAfter?: { commit: string; fingerprint: string };
    } | null;
}
export interface TestSuite {
    id: number;
    name: string;
    config: string;
    grep: string | null;
    runs: SuiteRun[];
}
