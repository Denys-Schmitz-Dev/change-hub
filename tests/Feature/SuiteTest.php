<?php

namespace Tests\Feature;

use App\Jobs\CaptureEnvironment;
use App\Jobs\RunTestSuite;
use App\Models\CaptureRun;
use App\Models\ChangeSession;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use App\Services\SuiteRunner;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SuiteTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_capture_queues_only_suite_runs_for_both_phases(): void
    {
        Queue::fake();
        $session = ChangeSession::factory()->create();
        $suites = TestSuite::factory()->count(2)->create(['change_session_id' => $session->id]);
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertSessionHasNoErrors()->assertRedirect();
        Queue::assertNotPushed(CaptureEnvironment::class);
        Queue::assertPushed(RunTestSuite::class, 2);
        foreach ($suites as $suite) {
            $this->assertDatabaseHas('suite_runs', ['test_suite_id' => $suite->id, 'phase' => 'before', 'status' => 'queued']);
            $suite->runs()->update(['status' => 'complete', 'report' => ['outcome' => 'failed']]);
        }
        $session->runs()->update(['status' => 'complete']);
        $this->post(route('captures.store', $session), ['phase' => 'after'])->assertSessionHasNoErrors()->assertRedirect();
        Queue::assertNotPushed(CaptureEnvironment::class);
        $this->assertDatabaseCount('capture_runs', 0);
        Queue::assertPushed(RunTestSuite::class, 4);
        foreach ($suites as $suite) {
            $this->assertDatabaseHas('suite_runs', ['test_suite_id' => $suite->id, 'phase' => 'after', 'status' => 'queued']);
        }
    }

    public function test_capture_preserves_existing_suite_baselines(): void
    {
        Queue::fake();
        $baseline = SuiteRun::factory()->create(['status' => 'complete']);
        TestSuite::factory()->create(['change_session_id' => $baseline->suite->change_session_id]);
        $this->post(route('captures.store', $baseline->suite->session), ['phase' => 'before'])->assertSessionHasNoErrors()->assertRedirect();
        Queue::assertNotPushed(CaptureEnvironment::class);
        Queue::assertPushed(RunTestSuite::class, 1);
        $this->assertDatabaseCount('suite_runs', 2);
        $this->assertSame('complete', $baseline->fresh()->status);
    }

    public function test_busy_suite_prevents_partial_capture_batch(): void
    {
        Queue::fake();
        $run = SuiteRun::factory()->create(['status' => 'running']);
        $this->post(route('captures.store', $run->suite->session), ['phase' => 'before'])->assertSessionHasErrors('capture');
        $this->assertDatabaseCount('capture_runs', 0);
        $this->assertDatabaseCount('suite_runs', 1);
        Queue::assertNothingPushed();
    }

    public function test_video_selection_does_not_skip_suites_or_change_test_filters(): void
    {
        Queue::fake();
        $session = ChangeSession::factory()->create();
        $home = TestSuite::factory()->create(['change_session_id' => $session->id]);
        $resume = TestSuite::factory()->create(['change_session_id' => $session->id]);
        $this->post(route('suites.video', $resume), ['mode' => 'selected'])->assertSessionHasNoErrors();
        $this->assertSame([], $resume->fresh()->selected_tests);
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertSessionHasNoErrors();
        Queue::assertPushed(RunTestSuite::class, 2);
        $this->assertTrue($home->runs()->firstOrFail()->capture_video);
        $this->assertTrue($resume->runs()->firstOrFail()->capture_video);
        $key = str_repeat('a', 64);
        $this->post(route('suites.video', $resume), ['mode' => 'selected', 'selected_tests' => [$key]])->assertSessionHasNoErrors();
        $this->assertSame([$key], $resume->fresh()->selected_tests);
        $this->assertSame($resume->grep, $resume->fresh()->grep);
        $this->post(route('suites.video', $resume), ['mode' => 'all'])->assertSessionHasNoErrors();
        $this->assertNull($resume->fresh()->selected_tests);
    }

    public function test_single_suite_still_runs_and_rejects_invalid_test_selection(): void
    {
        Queue::fake();
        $suite = TestSuite::factory()->create(['capture_video' => false]);
        $this->post(route('suites.video', $suite), ['mode' => 'selected', 'selected_tests' => ['invalid']])->assertSessionHasErrors('selected_tests.0');
        $this->post(route('suites.run', $suite), ['phase' => 'before'])->assertSessionHasNoErrors();
        $this->assertTrue($suite->runs()->firstOrFail()->capture_video);
        Queue::assertPushed(RunTestSuite::class, 1);
    }

    public function test_discovery_saves_the_test_catalog_without_queuing_a_run(): void
    {
        Queue::fake();
        $suite = TestSuite::factory()->create();
        $catalog = [['key' => str_repeat('a', 64), 'file' => 'home.spec.ts', 'title' => 'home.spec.ts > opens', 'project' => 'desktop']];
        Process::fake(['*' => Process::result(output: json_encode($catalog))]);
        $this->post(route('suites.tests', $suite))->assertSessionHasNoErrors();
        $this->assertSame($catalog, $suite->fresh()->test_catalog);
        $this->assertDatabaseCount('suite_runs', 0);
        Queue::assertNothingPushed();
    }

    public function test_failed_discovery_preserves_the_previous_catalog(): void
    {
        $suite = TestSuite::factory()->create(['test_catalog' => [['key' => 'existing']]]);
        Process::fake(['*' => Process::result(errorOutput: 'Config missing', exitCode: 1)]);
        $this->post(route('suites.tests', $suite))->assertSessionHasErrors('suite');
        $this->assertSame([['key' => 'existing']], $suite->fresh()->test_catalog);
    }

    public function test_new_suite_can_capture_after_without_fabricating_a_baseline(): void
    {
        Queue::fake();
        $baseline = SuiteRun::factory()->create(['status' => 'complete']);
        $suite = TestSuite::factory()->create(['change_session_id' => $baseline->suite->change_session_id]);
        $this->post(route('suites.run', $suite), ['phase' => 'after'])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('suite_runs', ['test_suite_id' => $suite->id, 'phase' => 'after']);
        $this->assertDatabaseMissing('suite_runs', ['test_suite_id' => $suite->id, 'phase' => 'before']);
    }

    public function test_missing_suite_baseline_prevents_partial_after_batch(): void
    {
        Queue::fake();
        $baseline = CaptureRun::factory()->create(['status' => 'complete']);
        TestSuite::factory()->create(['change_session_id' => $baseline->change_session_id]);
        $this->post(route('captures.store', $baseline->session), ['phase' => 'after'])->assertSessionHasErrors('capture');
        $this->assertDatabaseCount('capture_runs', 1);
        $this->assertDatabaseCount('suite_runs', 0);
        Queue::assertNothingPushed();
    }

    public function test_suite_config_must_be_inside_repository(): void
    {
        $session = ChangeSession::factory()->create(['profile' => ['repository' => base_path()]]);
        $this->post(route('suites.store', $session), ['name' => 'Test', 'config' => '../frontend/playwright.config.ts'])->assertSessionHasErrors('config');
        $this->assertDatabaseCount('test_suites', 0);
        $this->post(route('suites.store', $session), ['name' => 'Test', 'config' => 'playwright.config.js', 'grep' => 'Portfolio'])->assertRedirect();
        $this->assertDatabaseHas('test_suites', ['change_session_id' => $session->id, 'grep' => 'Portfolio']);
    }

    public function test_invalid_suite_input_is_rejected_before_creating_a_suite(): void
    {
        $session = ChangeSession::factory()->create();
        $this->post(route('suites.store', $session), ['name' => 'Test', 'config' => ['invalid']])
            ->assertSessionHasErrors('config');
        $this->assertDatabaseCount('test_suites', 0);
    }

    public function test_invalid_capture_phase_never_queues_work(): void
    {
        Queue::fake();
        $suite = TestSuite::factory()->create();
        $this->post(route('suites.run', $suite), ['phase' => 'invalid'])->assertSessionHasErrors('phase');
        $this->post(route('captures.store', $suite->session), ['phase' => 'invalid'])->assertSessionHasErrors('phase');
        $this->assertDatabaseCount('suite_runs', 0);
        Queue::assertNothingPushed();
    }

    public function test_suite_requires_its_own_baseline_and_prevents_duplicate_jobs(): void
    {
        Queue::fake();
        $suite = TestSuite::factory()->create();
        $this->post(route('suites.run', $suite), ['phase' => 'after'])->assertSessionHasErrors('suite');
        $this->post(route('suites.run', $suite), ['phase' => 'before'])->assertRedirect();
        $this->post(route('suites.run', $suite), ['phase' => 'before'])->assertSessionHasErrors('suite');
        Queue::assertPushed(RunTestSuite::class, 1);
    }

    public function test_completed_baseline_is_preserved_even_with_failed_assertions(): void
    {
        Queue::fake();
        $run = SuiteRun::factory()->create(['status' => 'complete', 'report' => ['outcome' => 'failed']]);
        $this->post(route('suites.run', $run->suite), ['phase' => 'before'])->assertSessionHasErrors('suite');
        $this->post(route('suites.run', $run->suite), ['phase' => 'after'])->assertRedirect();
        $this->assertSame('failed', $run->fresh()->report['outcome']);
        $this->assertDatabaseCount('suite_runs', 2);
    }

    public function test_job_saves_results_and_does_not_rerun_completed_jobs(): void
    {
        $run = SuiteRun::factory()->create();
        $runner = $this->mock(SuiteRunner::class);
        $runner->shouldReceive('run')->once()->andReturn(['status' => 'complete', 'outcome' => 'failed', 'tests' => [['title' => 'Feature', 'outcome' => 'unexpected']]]);
        $job = new RunTestSuite($run->id);
        $job->handle($runner);
        $job->handle($runner);
        $this->assertSame('complete', $run->fresh()->status);
        $this->assertSame('unexpected', $run->fresh()->report['tests'][0]['outcome']);
    }

    public function test_runner_failure_can_be_retried(): void
    {
        $run = SuiteRun::factory()->create();
        $runner = $this->mock(SuiteRunner::class);
        $runner->shouldReceive('run')->once()->andThrow(new \RuntimeException('No Playwright package'));
        (new RunTestSuite($run->id))->handle($runner);
        $this->assertSame('failed', $run->fresh()->status);
        Queue::fake();
        $this->post(route('suites.run', $run->suite), ['phase' => 'before'])->assertRedirect();
        Queue::assertPushed(RunTestSuite::class);
    }

    public function test_undeclared_suite_artifacts_cannot_be_downloaded(): void
    {
        $run = SuiteRun::factory()->create(['report' => ['tests' => []]]);
        $this->get(route('suites.artifact', [$run, 'abcdef.png']))->assertNotFound();
    }

    public function test_video_artifact_supports_range_requests_for_seeking(): void
    {
        $file = bin2hex(random_bytes(16)).'.webm';
        $run = SuiteRun::factory()->create(['report' => ['tests' => [['attachments' => [['file' => $file]]]]]]);
        $directory = storage_path('app/private/suites/'.$run->id.'/assets');
        File::ensureDirectoryExists($directory);
        file_put_contents($directory.'/'.$file, '0123456789');
        try {
            $this->withHeaders(['Range' => 'bytes=2-5'])->get(route('suites.artifact', [$run, $file]))
                ->assertStatus(206)->assertHeader('Content-Type', 'video/webm')->assertHeader('Content-Range', 'bytes 2-5/10')->assertHeader('Content-Length', '4');
        } finally {
            unlink($directory.'/'.$file);
        }
    }
}
