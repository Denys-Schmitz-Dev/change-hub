<?php

namespace App\Jobs;

use App\Models\SuiteRun;
use App\Services\SuiteRunner;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

class RunTestSuite implements ShouldQueue
{
    use Queueable;

    public int $tries = 100;

    public int $timeout = 270;

    public function __construct(public int $runId) {}

    public function middleware(): array
    {
        return [(new WithoutOverlapping('hub-browser'))->shared()->releaseAfter(5)->expireAfter(300)];
    }

    public function handle(SuiteRunner $runner): void
    {
        $run = SuiteRun::with('suite.session')->findOrFail($this->runId);
        if ($run->status !== 'queued') {
            return;
        }
        $run->update(['status' => 'running']);
        try {
            $report = $runner->run($run);
            $run->update(['status' => $report['status'], 'error' => $report['error'] ?? null, 'report' => $report]);
        } catch (Throwable $error) {
            $this->failed($error);
        }
    }

    public function failed(?Throwable $error): void
    {
        SuiteRun::whereKey($this->runId)->update(['status' => 'failed', 'error' => mb_substr($error?->getMessage() ?? 'Worker interrupted.', 0, 3000)]);
    }
}
