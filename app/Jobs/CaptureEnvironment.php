<?php

namespace App\Jobs;

use App\Models\CaptureRun;
use App\Services\BrowserRunner;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Throwable;

class CaptureEnvironment implements ShouldQueue
{
    use Queueable;

    public int $tries = 100;

    public int $timeout = 270;

    public function __construct(public int $runId) {}

    public function middleware(): array
    {
        return [(new WithoutOverlapping('hub-browser'))->shared()->releaseAfter(5)->expireAfter(300)];
    }

    public function handle(BrowserRunner $runner): void
    {
        $run = CaptureRun::with('session')->findOrFail($this->runId);
        if ($run->status !== 'queued') {
            return;
        }
        $run->update(['status' => 'running', 'started_at' => now()]);
        try {
            $report = $runner->run($run);
            foreach ($report['frames'] ?? [] as $frame) {
                $view = $run->views()->create(['key' => $frame['key'], 'status' => $frame['status'], 'observation' => $frame['observation'] ?? null, 'events' => ['messages' => $frame['messages'] ?? [], 'network' => $frame['network'] ?? []], 'error' => $frame['error'] ?? null]);
                foreach (['page.png', 'observation.json', 'events.json', 'accessibility.yml', 'trace.zip'] as $filename) {
                    $path = 'captures/'.$run->id.'/'.$frame['key'].'/'.$filename;
                    $absolute = storage_path('app/private/'.$path);
                    if (is_file($absolute)) {
                        $view->artifacts()->create(['name' => $filename, 'path' => $path, 'sha256' => hash_file('sha256', $absolute)]);
                    }
                }
            }
            $run->update(['status' => ($report['status'] ?? 'failed') === 'complete' ? 'complete' : 'failed', 'error' => $report['error'] ?? null, 'metadata' => array_diff_key($report, ['frames' => true]), 'completed_at' => now()]);
        } catch (Throwable $error) {
            $run->update(['status' => 'failed', 'error' => mb_substr($error->getMessage(), 0, 2000), 'completed_at' => now()]);
        }
    }

    public function failed(?Throwable $error): void
    {
        CaptureRun::whereKey($this->runId)->update(['status' => 'failed', 'error' => $error?->getMessage() ?? 'Worker interrupted.', 'completed_at' => now()]);
    }
}
