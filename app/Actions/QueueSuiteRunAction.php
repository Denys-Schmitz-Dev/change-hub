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
            $session = ChangeSession::whereKey($suite->change_session_id)->lockForUpdate()->firstOrFail();
            $suite = TestSuite::whereKey($suite->id)->lockForUpdate()->firstOrFail();
            if ($suite->runs()->whereIn('status', ['queued', 'running'])->exists()) {
                throw ValidationException::withMessages(['suite' => 'This suite is already running.']);
            }
            $baseline = app(SessionBaselineAction::class)->handle($session);
            if ($phase === 'before') {
                if ($baseline !== null && (! in_array($suite->id, $baseline['suite_ids'], true) || collect($baseline['runs'])->contains('test_suite_id', $suite->id))) {
                    throw ValidationException::withMessages(['suite' => 'The session baseline is locked and reused by every suite. Create a new session for a new baseline.']);
                }
                if ($baseline === null) {
                    $session->update(['baseline' => ['suite_ids' => [$suite->id], 'runs' => []]]);
                }
            } elseif (empty($baseline['runs'])) {
                throw ValidationException::withMessages(['suite' => 'Capture the session baseline first.']);
            }
            $run = $suite->runs()->create(['phase' => $phase, 'status' => 'queued', 'capture_video' => true]);
            RunTestSuite::dispatch($run->id)->afterCommit();

            return $run;
        });
    }
}
