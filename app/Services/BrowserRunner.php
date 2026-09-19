<?php

namespace App\Services;

use App\Models\CaptureRun;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;

class BrowserRunner
{
    public function run(CaptureRun $run): array
    {
        $directory = storage_path('app/private/captures/'.$run->id);
        File::ensureDirectoryExists($directory);
        $profile = $run->session->profile;
        $profile['output'] = $directory;
        $command = [config('hub.node'), base_path('runner/capture.mjs'), $directory.'/request.json'];
        if ($profile['runnerMode'] === 'docker') {
            $repository = $profile['repository'];
            $profile['repository'] = '/project';
            $profile['output'] = '/output';
            $command = ['docker', 'run', '--rm', '--init', '--ipc=host', '--network', $profile['dockerNetwork'], '--mount', 'type=bind,source='.base_path().',target=/hub,readonly', '--mount', 'type=bind,source='.$repository.',target=/project,readonly', '--mount', 'type=bind,source='.$directory.',target=/output', '--workdir', '/hub', config('hub.docker_image'), 'node', 'runner/capture.mjs', '/output/request.json'];
        }
        File::put($directory.'/request.json', json_encode($profile, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));
        $result = Process::path(base_path())->timeout(config('hub.capture_timeout'))->run($command);
        if (! is_file($directory.'/result.json')) {
            throw new RuntimeException('Capture runner failed: '.mb_substr($result->errorOutput() ?: $result->output(), 0, 2000));
        }
        $report = json_decode(File::get($directory.'/result.json'), true, 512, JSON_THROW_ON_ERROR);
        if (! $result->successful()) {
            $report['status'] = 'failed';
            $report['error'] = $report['error'] ?? 'Runner exited unsuccessfully.';
        }

        return $report;
    }
}
