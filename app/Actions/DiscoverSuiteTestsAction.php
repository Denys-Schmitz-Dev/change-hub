<?php

namespace App\Actions;

use App\Models\TestSuite;
use Illuminate\Support\Facades\Process;
use Illuminate\Validation\ValidationException;

class DiscoverSuiteTestsAction
{
    public function handle(TestSuite $suite): void
    {
        $request = [
            'repository' => $suite->session->profile['repository'],
            'config' => $suite->config,
            'grep' => $suite->grep,
            'baseURL' => $suite->session->profile['baseURL'],
        ];
        $process = Process::path(base_path())->timeout(45)->input(json_encode($request, JSON_THROW_ON_ERROR))
            ->run([config('hub.node'), base_path('runner/discover-suite.mjs')]);
        if (! $process->successful()) {
            throw ValidationException::withMessages(['suite' => 'Could not load tests: '.mb_substr($process->errorOutput(), 0, 2000)]);
        }
        $catalog = json_decode($process->output(), true, 512, JSON_THROW_ON_ERROR);
        $suite->update(['test_catalog' => $catalog]);
    }
}
