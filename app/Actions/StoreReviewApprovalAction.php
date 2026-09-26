<?php

namespace App\Actions;

use App\Models\ChangeSession;

class StoreReviewApprovalAction
{
    /** @param array{run_id: int|string, file: string, reason: string, note?: string|null} $data */
    public function store(ChangeSession $session, array $data): void
    {
        $runId = (int) $data['run_id'];
        $approvals = collect($session->review_approvals ?? [])->reject(
            fn (array $approval): bool => (int) $approval['run_id'] === $runId && $approval['file'] === $data['file'],
        )->values()->all();
        $approvals[] = ['run_id' => $runId, 'file' => $data['file'], 'reason' => $data['reason'], 'note' => $data['note'] ?? null, 'approved_at' => now()->toISOString()];
        $session->update(['review_approvals' => $approvals]);
    }

    public function destroy(ChangeSession $session, int $runId, string $file): void
    {
        $session->update(['review_approvals' => collect($session->review_approvals ?? [])->reject(
            fn (array $approval): bool => (int) $approval['run_id'] === $runId && $approval['file'] === $file,
        )->values()->all()]);
    }
}
