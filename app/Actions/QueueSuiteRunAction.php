<?php

namespace App\Actions;

use App\Jobs\RunTestSuite;
use App\Models\ChangeSession;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QueueSuiteRunAction
{
    public function handle(TestSuite $suite, string $phase): SuiteRun
    {
        return DB::transaction(function () use ($suite, $phase): SuiteRun {
            ChangeSession::whereKey($suite->change_session_id)->lockForUpdate()->firstOrFail();
            $suite = TestSuite::whereKey($suite->id)->lockForUpdate()->firstOrFail();
            if ($suite->runs()->whereIn('status', ['queued', 'running'])->exists()) {
                throw ValidationException::withMessages(['suite' => 'This suite is already running.']);
            }
            $baseline = $suite->runs()->where('phase', 'before')->where('status', 'complete')->exists();
            $sessionBaseline = $suite->session->suites()->whereHas('runs', fn ($query) => $query->where('phase', 'before')->where('status', 'complete'))->exists();
            if (($phase === 'before' && $baseline) || ($phase === 'after' && ! $sessionBaseline)) {
                throw ValidationException::withMessages(['suite' => $baseline ? 'The suite baseline is locked. Add another suite to start over.' : 'Capture this suite’s before state first.']);
            }
            $run = $suite->runs()->create(['phase' => $phase, 'status' => 'queued', 'capture_video' => true]);
            RunTestSuite::dispatch($run->id)->afterCommit();

            return $run;
        });
    }
}
