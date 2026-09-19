<?php

namespace Tests\Feature;

use App\Jobs\RunTestSuite;
use App\Models\ChangeSession;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use App\Services\SuiteRunner;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SuiteTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_suite_config_must_be_inside_repository(): void
    {
        $session = ChangeSession::factory()->create(['profile' => ['repository' => base_path()]]);
        $this->post(route('suites.store', $session), ['name' => 'Test', 'config' => '../frontend/playwright.config.ts'])->assertSessionHasErrors('config');
        $this->assertDatabaseCount('test_suites', 0);
        $this->post(route('suites.store', $session), ['name' => 'Test', 'config' => 'playwright.config.js', 'grep' => 'Portfolio'])->assertRedirect();
        $this->assertDatabaseHas('test_suites', ['change_session_id' => $session->id, 'grep' => 'Portfolio']);
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
