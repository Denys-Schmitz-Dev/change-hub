<?php

namespace Tests\Feature;

use App\Jobs\CaptureEnvironment;
use App\Jobs\RunTestSuite;
use App\Models\Artifact;
use App\Models\CaptureRun;
use App\Models\ChangeSession;
use App\Models\Environment;
use App\Models\Project;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use App\Services\BrowserRunner;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class HubTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_connects_a_repository_without_starting_an_environment(): void
    {
        $this->post(route('projects.store'), ['name' => 'Website', 'repository_path' => dirname(base_path()), 'playwright_config' => 'change-hub/playwright.config.js', 'suite_name' => 'Home', 'test_filter' => 'Home'])->assertSessionHasNoErrors()->assertRedirect();
        $this->assertDatabaseHas('projects', ['name' => 'Website', 'repository_path' => dirname(base_path())]);
        $this->assertDatabaseCount('environments', 0);
    }

    public function test_rejects_non_repository_paths(): void
    {
        $this->post(route('projects.store'), ['name' => 'No repo', 'repository_path' => storage_path()])->assertSessionHasErrors('repository_path');
        $this->assertDatabaseCount('projects', 0);
    }

    public function test_registers_a_docker_network_environment(): void
    {
        $project = Project::factory()->create();
        $this->post(route('environments.store', $project), ['name' => 'Docker local', 'base_url' => 'http://web:80', 'runner_mode' => 'docker', 'docker_network' => 'site_default', 'profile' => 'live', 'allowed_origins' => 'http://api:80'])->assertRedirect();
        $this->assertDatabaseHas('environments', ['project_id' => $project->id, 'docker_network' => 'site_default', 'base_url' => 'http://web:80']);
    }

    #[TestWith(['http://user:secret@localhost:80', 'local', null])]
    #[TestWith(['http://localhost:80/path', 'local', null])]
    #[TestWith(['http://web:80', 'docker', 'bad network;command'])]
    public function test_rejects_invalid_environment_connections(string $url, string $mode, ?string $network): void
    {
        $project = Project::factory()->create();
        $this->post(route('environments.store', $project), ['name' => 'Invalid', 'base_url' => $url, 'runner_mode' => $mode, 'docker_network' => $network, 'profile' => 'live'])->assertSessionHasErrors();
        $this->assertDatabaseCount('environments', 0);
    }

    public function test_freezes_the_environment_profile_in_a_new_session(): void
    {
        $environment = Environment::factory()->create();
        $this->post(route('sessions.store'), ['environment_id' => $environment->id, 'title' => 'A change', 'path' => '/about', 'devices' => ['desktop'], 'scenarios' => ['live'], 'profile' => ['baseURL' => 'https://injected.example']])->assertRedirect();
        $session = ChangeSession::firstOrFail();
        $environment->update(['base_url' => 'http://127.0.0.1:7777']);
        $this->assertSame('http://127.0.0.1:5175', $session->profile['baseURL']);
        $this->assertSame('/about', $session->profile['path']);
    }

    public function test_creates_default_suite_without_page_capture_options(): void
    {
        $environment = Environment::factory()->create();
        $environment->project->update(['playwright_config' => 'playwright.config.js', 'suite_name' => 'Home', 'test_filter' => 'Home']);
        $this->post(route('sessions.store'), ['environment_id' => $environment->id, 'title' => 'A change'])->assertSessionHasNoErrors();
        $this->assertDatabaseHas('test_suites', ['name' => 'Home', 'config' => 'playwright.config.js', 'grep' => 'Home']);
    }

    public function test_queues_before_and_rejects_a_duplicate(): void
    {
        Queue::fake();
        $session = ChangeSession::factory()->create();
        $suite = TestSuite::factory()->create(['change_session_id' => $session->id]);
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertRedirect(route('sessions.show', $session));
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertSessionHasErrors('capture');
        $run = $suite->runs()->firstOrFail();
        $this->assertSame('queued', $run->status);
        $this->assertDatabaseCount('suite_runs', 1);
        Queue::assertPushed(RunTestSuite::class, fn ($job) => $job->runId === $run->id);
        Queue::assertPushed(RunTestSuite::class, 1);
    }

    public function test_requires_a_baseline_before_after_capture(): void
    {
        Queue::fake([CaptureEnvironment::class]);
        $session = ChangeSession::factory()->create();
        $this->post(route('captures.store', $session), ['phase' => 'after'])->assertSessionHasErrors('capture');
        $this->assertDatabaseCount('capture_runs', 0);
        Queue::assertNotPushed(CaptureEnvironment::class);
    }

    public function test_preserves_baseline_when_queuing_an_after_version(): void
    {
        Queue::fake();
        $session = ChangeSession::factory()->create();
        $suite = TestSuite::factory()->create(['change_session_id' => $session->id]);
        $baseline = SuiteRun::factory()->create(['test_suite_id' => $suite->id, 'status' => 'complete']);
        $this->post(route('captures.store', $session), ['phase' => 'before'])->assertSessionHasErrors('capture');
        $this->post(route('captures.store', $session), ['phase' => 'after'])->assertRedirect();
        $this->assertSame('complete', $baseline->fresh()->status);
        $this->assertDatabaseCount('suite_runs', 2);
        Queue::assertPushed(RunTestSuite::class, 1);
    }

    public function test_failed_runner_attempt_is_retained_and_can_be_retried(): void
    {
        $run = CaptureRun::factory()->create();
        $this->mock(BrowserRunner::class, function (MockInterface $mock): void {
            $mock->shouldReceive('run')->once()->andThrow(new \RuntimeException('Browser missing'));
        });
        (new CaptureEnvironment($run->id))->handle(app(BrowserRunner::class));
        $this->assertSame('failed', $run->fresh()->status);
        $this->assertSame('Browser missing', $run->fresh()->error);
        Queue::fake();
        TestSuite::factory()->create(['change_session_id' => $run->change_session_id]);
        $this->post(route('captures.store', $run->session), ['phase' => 'before'])->assertRedirect();
        $this->assertDatabaseCount('capture_runs', 1);
        $this->assertDatabaseCount('suite_runs', 1);
        Queue::assertPushed(RunTestSuite::class, 1);
    }

    public function test_saves_structured_observations_from_the_runner(): void
    {
        $run = CaptureRun::factory()->create();
        $this->mock(BrowserRunner::class, function (MockInterface $mock): void {
            $mock->shouldReceive('run')->once()->andReturn(['status' => 'complete', 'browserVersion' => 'test', 'frames' => [['key' => 'desktop-live', 'status' => 'complete', 'observation' => ['text' => ['Hello']]]]]);
        });
        (new CaptureEnvironment($run->id))->handle(app(BrowserRunner::class));
        $this->assertSame('complete', $run->fresh()->status);
        $this->assertSame(['Hello'], $run->views()->firstOrFail()->observation['text']);
    }

    public function test_rejects_remote_and_cross_origin_requests(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])->get(route('home'))->assertForbidden();
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])->withHeaders(['Origin' => 'https://untrusted.example'])->post(route('projects.store'), [])->assertForbidden();
        $this->assertDatabaseCount('projects', 0);
    }

    public function test_artifacts_cannot_serve_files_outside_capture_storage(): void
    {
        $artifact = Artifact::factory()->create(['path' => '../../../.env']);
        $this->get(route('artifacts.show', $artifact))->assertNotFound();
    }

    public function test_home_includes_suite_status_without_full_reports(): void
    {
        $run = SuiteRun::factory()->create(['status' => 'complete', 'phase' => 'before', 'report' => ['private_report_marker' => 'large report']]);
        $this->get(route('sessions.show', $run->suite->session))->assertOk();
        $this->get(route('home'))->assertOk()->assertDontSee('private_report_marker')->assertViewHas('payload', function (array $payload) use ($run): bool {
            $session = $payload['props']['sessions']->firstWhere('id', $run->suite->change_session_id);
            $listed = $session->suites->first()->runs->first();

            return $listed->status === 'complete' && $listed->phase === 'before' && ! array_key_exists('report', $listed->getAttributes());
        });
    }

    public function test_session_detail_only_sends_the_latest_after_run_for_each_suite(): void
    {
        $suite = TestSuite::factory()->create();
        SuiteRun::factory()->create([
            'test_suite_id' => $suite->id,
            'phase' => 'after',
            'status' => 'complete',
            'report' => ['marker' => 'older after run'],
        ]);
        SuiteRun::factory()->create([
            'test_suite_id' => $suite->id,
            'phase' => 'after',
            'status' => 'complete',
            'report' => ['marker' => 'latest after run'],
        ]);

        $this->get(route('sessions.show', $suite->session))
            ->assertOk()
            ->assertSee('latest after run')
            ->assertDontSee('older after run');
    }

    public function test_blade_escapes_project_content(): void
    {
        Project::factory()->create(['name' => '<script>alert(1)</script>']);
        $this->get(route('home'))->assertSee('\\u003Cscript\\u003E', false)->assertDontSee('<script>alert(1)</script>', false);
    }
}
