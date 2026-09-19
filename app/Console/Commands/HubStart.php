<?php

namespace App\Console\Commands;

use App\Models\CaptureRun;
use App\Models\SuiteRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\Process\Process;

class HubStart extends Command
{
    protected $signature = 'hub:start {--port=4320 : Local dashboard port} {--frontend : Start Vite with hot reload}';

    protected $description = 'Start the local dashboard and a single database queue worker';

    public function handle(): int
    {
        $port = filter_var($this->option('port'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1025, 'max_range' => 65535]]);
        if (! $port) {
            $this->error('Choose a port between 1025 and 65535.');

            return self::FAILURE;
        }
        $lock = fopen(storage_path('framework/hub.lock'), 'c');
        if (! $lock || ! flock($lock, LOCK_EX | LOCK_NB)) {
            $this->error('This hub is already running.');

            return self::FAILURE;
        }
        CaptureRun::where('status', 'running')->update(['status' => 'failed', 'error' => 'The previous worker stopped during capture. Retry this phase.', 'completed_at' => now()]);
        SuiteRun::where('status', 'running')->update(['status' => 'failed', 'error' => 'Worker stopped during test execution. Retry this run.']);
        Cache::lock('laravel-queue-overlap:hub-browser')->forceRelease();
        $web = new Process([PHP_BINARY, 'artisan', 'serve', '--host=127.0.0.1', '--port='.(string) $port, '--no-reload'], base_path());
        $worker = new Process([PHP_BINARY, 'artisan', 'queue:work', 'database', '--sleep=1', '--timeout=270', '--tries=100'], base_path());
        $processes = [$web, $worker];
        if ($this->option('frontend')) {
            $processes[] = new Process(['node', 'node_modules/vite/bin/vite.js', '--host=127.0.0.1', '--port=5176', '--strictPort'], base_path());
        }
        $running = true;
        $this->trap([SIGINT, SIGTERM], function () use (&$running): void {
            $running = false;
        });
        try {
            foreach ($processes as $process) {
                $process->setTimeout(null);
                $process->start();
            }
            $this->info('Change Hub: http://127.0.0.1:'.$port);
            $this->line('Attaches to existing project environments. Press Ctrl+C to stop.');
            while ($running && collect($processes)->every(fn (Process $process): bool => $process->isRunning())) {
                foreach ($processes as $process) {
                    $this->output->write($process->getIncrementalOutput());
                    $this->output->write($process->getIncrementalErrorOutput());
                } usleep(200000);
            }
            if ($running) {
                $this->error(collect($processes)->map(fn (Process $process): string => $process->getErrorOutput())->implode("\n"));

                return self::FAILURE;
            }

            return self::SUCCESS;
        } finally {
            foreach (array_reverse($processes) as $process) {
                $process->stop(3);
            }
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}
