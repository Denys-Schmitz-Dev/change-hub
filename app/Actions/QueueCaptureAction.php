<?php

namespace App\Actions;

use App\Jobs\RunTestSuite;
use App\Models\ChangeSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QueueCaptureAction
{
    public function handle(ChangeSession $session, string $phase): array
    {
        return DB::transaction(function () use ($session, $phase): array {
            $session = ChangeSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            if (! in_array($phase, ['before', 'after'], true)) {
                throw ValidationException::withMessages(['phase' => 'Choose before or after.']);
            }
            $suites = $session->suites()->lockForUpdate()->get();
            if ($suites->isEmpty()) {
                throw ValidationException::withMessages(['capture' => 'Add a Playwright suite before capturing.']);
            }
            if ($session->runs()->whereIn('status', ['queued', 'running'])->exists() || $suites->contains(fn ($suite): bool => $suite->runs()->whereIn('status', ['queued', 'running'])->exists())) {
                throw ValidationException::withMessages(['capture' => 'A run is already queued or running for this session.']);
            }
            $baseline = app(SessionBaselineAction::class)->handle($session);
            $hasBaseline = ! empty($baseline['runs']);
            if ($phase === 'after' && ! $hasBaseline) {
                throw ValidationException::withMessages(['capture' => 'Capture the session baseline first.']);
            }
            if ($phase === 'before' && $baseline === null) {
                $baseline = ['suite_ids' => $suites->pluck('id')->all(), 'runs' => []];
                $session->update(['baseline' => $baseline]);
            }
            $capturedIds = array_column($baseline['runs'] ?? [], 'test_suite_id');
            $pending = $suites->filter(fn ($suite): bool => $phase === 'after' || (in_array($suite->id, $baseline['suite_ids'] ?? [], true) && ! in_array($suite->id, $capturedIds, true)));
            if ($pending->isEmpty()) {
                throw ValidationException::withMessages(['capture' => 'The session baseline is locked and reused by every suite. Create a new session for a new baseline.']);
            }
            $runs = [];
            foreach ($pending as $suite) {
                $run = $suite->runs()->create(['phase' => $phase, 'status' => 'queued', 'capture_video' => true]);
                RunTestSuite::dispatch($run->id)->afterCommit();
                $runs[] = $run;
            }

            return $runs;
        });
    }
}
