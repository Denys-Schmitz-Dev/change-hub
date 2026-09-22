<?php

namespace App\Services;

use App\Models\SuiteRun;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;

class SuiteRunner
{
    public function run(SuiteRun $run): array
    {
        $directory = storage_path('app/private/suites/'.$run->id);
        File::ensureDirectoryExists($directory);
        $suite = $run->suite;
        $request = ['repository' => $suite->session->profile['repository'], 'config' => $suite->config, 'grep' => $suite->grep, 'phase' => $run->phase, 'output' => $directory, 'baseURL' => $suite->session->profile['baseURL'], 'captureVideo' => $run->capture_video];
        File::put($directory.'/request.json', json_encode($request, JSON_THROW_ON_ERROR));
        $process = Process::path(base_path())->timeout(240)->run([config('hub.node'), base_path('runner/suite.mjs'), $directory.'/request.json']);
        if (! is_file($directory.'/result.json')) {
            throw new RuntimeException('Test runner did not produce a report: '.mb_substr($process->errorOutput(), 0, 2000));
        }
        $report = json_decode(File::get($directory.'/result.json'), true, 512, JSON_THROW_ON_ERROR);
        if (! $process->successful()) {
            $report['status'] = 'failed';
        }

        return $report;
    }
}
