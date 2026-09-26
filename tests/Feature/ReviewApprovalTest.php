<?php

namespace Tests\Feature;

use App\Models\SuiteRun;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReviewApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_completed_after_run_gap_can_be_approved_and_revoked(): void
    {
        $run = SuiteRun::factory()->create(['phase' => 'after', 'status' => 'complete']);
        $session = $run->suite->session;

        $this->post(route('sessions.review-approvals.store', $session), [
            'run_id' => $run->id,
            'file' => 'database/migrations/add_index.php',
            'reason' => 'no_test_needed',
            'note' => 'Schema inspection is sufficient.',
        ])->assertRedirect(route('sessions.show', $session));

        $approval = $session->fresh()->review_approvals[0];
        $this->assertSame($run->id, $approval['run_id']);
        $this->assertSame('no_test_needed', $approval['reason']);
        $this->assertNotEmpty($approval['approved_at']);

        $this->delete(route('sessions.review-approvals.destroy', $session), [
            'run_id' => $run->id,
            'file' => 'database/migrations/add_index.php',
        ])->assertRedirect(route('sessions.show', $session));

        $this->assertSame([], $session->fresh()->review_approvals);
    }

    public function test_approval_must_reference_a_completed_after_run_in_the_session(): void
    {
        $session = SuiteRun::factory()->create()->suite->session;
        $otherRun = SuiteRun::factory()->create(['phase' => 'after', 'status' => 'complete']);

        $this->from(route('sessions.show', $session))->post(route('sessions.review-approvals.store', $session), [
            'run_id' => $otherRun->id,
            'file' => 'src/App.tsx',
            'reason' => 'covered_elsewhere',
        ])->assertSessionHasErrors('approval');

        $this->assertNull($session->fresh()->review_approvals);
    }

    public function test_browser_form_run_ids_are_stored_as_integers(): void
    {
        $run = SuiteRun::factory()->create(['phase' => 'after', 'status' => 'complete']);

        $this->post(route('sessions.review-approvals.store', $run->suite->session), [
            'run_id' => (string) $run->id,
            'file' => 'src/App.tsx',
            'reason' => 'manually_verified',
        ])->assertRedirect();

        $this->assertSame($run->id, $run->suite->session->fresh()->review_approvals[0]['run_id']);
    }
}
