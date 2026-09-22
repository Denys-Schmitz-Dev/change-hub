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
            $hasBaseline = $suites->contains(fn ($suite): bool => $suite->runs()->where('phase', 'before')->where('status', 'complete')->exists());
            if ($phase === 'after' && ! $hasBaseline) {
                throw ValidationException::withMessages(['capture' => 'Capture a before run first.']);
            }
            $pending = $suites->filter(fn ($suite): bool => $phase === 'after' || ! $suite->runs()->where('phase', 'before')->where('status', 'complete')->exists());
            if ($pending->isEmpty()) {
                throw ValidationException::withMessages(['capture' => 'All suite baselines are locked.']);
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
