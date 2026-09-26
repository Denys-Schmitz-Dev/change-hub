<?php

namespace App\Actions;

use App\Models\ChangeSession;
use App\Models\TestSuite;
use Illuminate\Support\Facades\Process;
use Illuminate\Validation\ValidationException;

class DiscoverSuiteTestsAction
{
    public function handle(TestSuite $suite): void
    {
        $catalog = $this->catalog($suite->session, $suite->config, $suite->grep);
        if ($suite->test_selection !== null) {
            $keys = array_column($suite->test_selection, 'key');
            $catalog = array_values(array_filter($catalog, fn (array $test): bool => in_array($test['key'], $keys, true)));
        }
        $suite->update(['test_catalog' => $catalog]);
    }

    public function catalog(ChangeSession $session, string $config, ?string $grep = null): array
    {
        $request = [
            'repository' => $session->profile['repository'],
            'config' => $config,
            'grep' => $grep,
            'baseURL' => $session->profile['baseURL'],
        ];
        $process = Process::path(base_path())->timeout(45)->input(json_encode($request, JSON_THROW_ON_ERROR))
            ->run([config('hub.node'), base_path('runner/discover-suite.mjs')]);
        if (! $process->successful()) {
            throw ValidationException::withMessages(['suite' => 'Could not load tests: '.mb_substr($process->errorOutput(), 0, 2000)]);
        }
        $catalog = json_decode($process->output(), true, 512, JSON_THROW_ON_ERROR);

        return $catalog;
    }
}
