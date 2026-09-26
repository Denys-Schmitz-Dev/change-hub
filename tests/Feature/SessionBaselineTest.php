<?php

namespace Tests\Feature;

use App\Models\ChangeSession;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SessionBaselineTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_later_suites_reuse_the_baseline_and_cannot_capture_a_new_before(): void
    {
        Queue::fake();
        $original = SuiteRun::factory()->create(['status' => 'complete', 'report' => ['outcome' => 'passed', 'tests' => []]]);
        $session = $original->suite->session;
        $later = TestSuite::factory()->create(['change_session_id' => $session->id]);
        $this->get(route('sessions.show', $session))->assertOk();
        $this->assertSame($original->id, $session->fresh()->baseline['runs'][0]['id']);
        $this->post(route('suites.run', $later), ['phase' => 'before'])->assertSessionHasErrors('suite');
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertSessionHasErrors('capture');
        $this->post(route('suites.run', $later), ['phase' => 'after'])->assertSessionHasNoErrors();
        $this->assertDatabaseMissing('suite_runs', ['test_suite_id' => $later->id, 'phase' => 'before']);
        $this->assertDatabaseHas('suite_runs', ['test_suite_id' => $later->id, 'phase' => 'after']);
    }

    public function test_original_failed_baseline_can_retry_but_new_suites_cannot_join_it(): void
    {
        Queue::fake();
        $session = ChangeSession::factory()->create();
        $suites = TestSuite::factory()->count(2)->create(['change_session_id' => $session->id]);
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertSessionHasNoErrors();
        $suites[0]->runs()->update(['status' => 'complete']);
        $suites[1]->runs()->update(['status' => 'failed']);
        $late = TestSuite::factory()->create(['change_session_id' => $session->id]);
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertSessionHasNoErrors();
        $this->assertSame(1, $suites[0]->runs()->count());
        $this->assertSame(2, $suites[1]->runs()->count());
        $this->assertSame(0, $late->runs()->count());
    }

    public function test_baseline_evidence_survives_removing_its_original_suite(): void
    {
        Queue::fake();
        $file = str_repeat('a', 64).'.png';
        $run = SuiteRun::factory()->create(['status' => 'complete', 'report' => ['tests' => [['key' => 'home', 'attachments' => [['file' => $file]]]]]]);
        $session = $run->suite->session;
        $directory = storage_path('app/private/suites/'.$run->id.'/assets');
        File::ensureDirectoryExists($directory);
        File::put($directory.'/'.$file, 'saved baseline');
        try {
            $this->delete(route('suites.destroy', $run->suite))->assertSessionHasNoErrors();
            $this->assertModelMissing($run);
            $baseline = $session->fresh()->baseline['runs'][0];
            $this->assertSame($run->id, $baseline['id']);
            $this->get(str_replace('__FILE__', $file, $baseline['artifact_base']))->assertOk();
            $this->get(str_replace('__FILE__', str_repeat('b', 64).'.png', $baseline['artifact_base']))->assertNotFound();
            $other = ChangeSession::factory()->create();
            $this->get(route('sessions.baseline-artifact', ['session' => $other, 'runId' => $run->id, 'file' => $file]))->assertNotFound();
            $later = TestSuite::factory()->create(['change_session_id' => $session->id]);
            $this->post(route('suites.run', $later), ['phase' => 'after'])->assertSessionHasNoErrors();
            $this->post(route('suites.run', $later), ['phase' => 'before'])->assertSessionHasErrors('suite');
        } finally {
            File::deleteDirectory(dirname($directory));
        }
    }
}
