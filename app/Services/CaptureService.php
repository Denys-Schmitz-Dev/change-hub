<?php

namespace App\Services;

use App\Jobs\CaptureEnvironment;
use App\Models\CaptureRun;
use App\Models\ChangeSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CaptureService
{
    public function queue(ChangeSession $session, string $phase): CaptureRun
    {
        return DB::transaction(function () use ($session, $phase) {
            $session = ChangeSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            if ($session->runs()->whereIn('status', ['queued', 'running'])->exists()) {
                throw ValidationException::withMessages(['capture' => 'A capture is already queued or running for this session.']);
            }
            if (! in_array($phase, ['before', 'after'], true)) {
                throw ValidationException::withMessages(['phase' => 'Choose before or after.']);
            }
            $baseline = $session->runs()->where('phase', 'before')->where('status', 'complete')->exists();
            if (($phase === 'before' && $baseline) || ($phase === 'after' && ! $baseline)) {
                throw ValidationException::withMessages(['capture' => $baseline ? 'The baseline is locked. Start a new session to replace it.' : 'Capture a successful baseline first.']);
            }
            if (($session->profile['version'] ?? 0) !== config('hub.profile_version')) {
                throw ValidationException::withMessages(['capture' => 'The capture profile version changed. Start a new session.']);
            }
            $run = $session->runs()->create(['phase' => $phase, 'status' => 'queued']);
            CaptureEnvironment::dispatch($run->id);

            return $run;
        });
    }
}
