<?php

namespace App\Actions;

use App\Models\ChangeSession;
use App\Models\SuiteRun;
use Illuminate\Support\Facades\DB;

class SessionBaselineAction
{
    public function handle(ChangeSession $session): ?array
    {
        return DB::transaction(function () use ($session): ?array {
            $session = ChangeSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            $baseline = $session->baseline;
            if ($baseline !== null && count($baseline['runs']) >= count($baseline['suite_ids'])) {
                return $baseline;
            }
            $completed = SuiteRun::with('suite')->whereHas('suite', fn ($query) => $query->where('change_session_id', $session->id))
                ->where('phase', 'before')->where('status', 'complete')->orderBy('id')->get();
            if ($baseline === null && $completed->isEmpty()) {
                return null;
            }
            $baseline ??= ['suite_ids' => $completed->pluck('test_suite_id')->unique()->values()->all(), 'runs' => []];
            foreach ($completed as $run) {
                if (! in_array($run->test_suite_id, $baseline['suite_ids'], true) || collect($baseline['runs'])->contains('test_suite_id', $run->test_suite_id)) {
                    continue;
                }
                $baseline['runs'][] = [
                    'id' => $run->id, 'test_suite_id' => $run->test_suite_id, 'config' => $run->suite->config,
                    'phase' => 'before', 'status' => 'complete', 'capture_video' => $run->capture_video,
                    'created_at' => $run->created_at->toISOString(), 'error' => $run->error, 'report' => $run->report,
                    'artifact_base' => route('sessions.baseline-artifact', ['session' => $session->id, 'runId' => $run->id, 'file' => '__FILE__'], false),
                ];
            }
            if ($baseline !== $session->baseline) {
                $session->update(['baseline' => $baseline]);
            }

            return $baseline;
        });
    }
}
