<?php

namespace Tests\Feature;

use App\Models\ChangeSession;
use App\Models\TestSuite;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class TestPickerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function catalog(): array
    {
        return [
            ['key' => str_repeat('a', 64), 'file' => 'checkout.spec.ts', 'title' => 'checkout.spec.ts › accepts [draft] (a+b)?', 'project' => 'desktop', 'listEntry' => '[desktop] › checkout.spec.ts › accepts [draft] (a+b)?'],
            ['key' => str_repeat('b', 64), 'file' => 'checkout.spec.ts', 'title' => 'checkout.spec.ts › accepts [draft] (a+b)?', 'project' => 'mobile', 'listEntry' => '[mobile] › checkout.spec.ts › accepts [draft] (a+b)?'],
        ];
    }

    public function test_discovery_lists_tests_without_creating_a_suite_or_run(): void
    {
        Queue::fake();
        $session = ChangeSession::factory()->create();
        Process::fake(['*' => Process::result(output: json_encode($this->catalog()))]);
        $this->postJson(route('sessions.test-catalog', $session), ['config' => 'playwright.config.js'])->assertOk()->assertJsonCount(2, 'tests');
        $this->assertDatabaseCount('test_suites', 0);
        $this->assertDatabaseCount('suite_runs', 0);
        Queue::assertNothingPushed();
    }

    public function test_discovery_rejects_paths_outside_the_repository(): void
    {
        Process::fake();
        $session = ChangeSession::factory()->create();
        $this->postJson(route('sessions.test-catalog', $session), ['config' => '../outside.js'])->assertUnprocessable()->assertJsonValidationErrors('config');
        Process::assertNothingRan();
    }

    public function test_adds_only_server_discovered_selections_without_a_regex(): void
    {
        Queue::fake();
        $session = ChangeSession::factory()->create();
        Process::fake(['*' => Process::result(output: json_encode($this->catalog()))]);
        $this->postJson(route('sessions.selected-tests', $session), ['name' => 'Checkout checks', 'config' => 'playwright.config.js', 'test_keys' => [str_repeat('a', 64)], 'grep' => 'injected', 'test_selection' => [['listEntry' => 'injected']]])->assertRedirect(route('sessions.show', $session));
        $suite = TestSuite::firstOrFail();
        $this->assertNull($suite->grep);
        $this->assertSame([$this->catalog()[0]], $suite->test_selection);
        $this->assertSame($suite->test_selection, $suite->test_catalog);
        Queue::assertNothingPushed();
    }

    public function test_stale_or_empty_selections_do_not_create_a_suite(): void
    {
        $session = ChangeSession::factory()->create();
        Process::fake(['*' => Process::result(output: json_encode($this->catalog()))]);
        foreach ([[], [str_repeat('c', 64)], [str_repeat('a', 64), str_repeat('a', 64)]] as $keys) {
            $this->postJson(route('sessions.selected-tests', $session), ['name' => 'Selected', 'config' => 'playwright.config.js', 'test_keys' => $keys])->assertUnprocessable();
        }
        $this->assertDatabaseCount('test_suites', 0);
    }

    public function test_discovery_failure_is_actionable_and_does_not_save_a_suite(): void
    {
        $session = ChangeSession::factory()->create();
        Process::fake(['*' => Process::result(errorOutput: 'Invalid test configuration', exitCode: 1)]);
        $this->postJson(route('sessions.test-catalog', $session), ['config' => 'playwright.config.js'])->assertUnprocessable()->assertJsonValidationErrors('suite');
        $this->assertDatabaseCount('test_suites', 0);
    }
}
