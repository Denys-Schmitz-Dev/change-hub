<?php

namespace App\Http\Controllers;

use App\Jobs\RunTestSuite;
use App\Models\ChangeSession;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TestSuiteController extends Controller
{
    public function store(Request $request, ChangeSession $session): RedirectResponse
    {
        $data = $request->validate(['name' => 'required|string|max:120', 'config' => 'required|string|max:500', 'grep' => 'nullable|string|max:200']);
        $root = realpath($session->profile['repository']);
        $path = realpath($root.'/'.$data['config']);
        if (! $root || ! $path || ! is_file($path) || ! str_starts_with($path, $root.DIRECTORY_SEPARATOR)) {
            throw ValidationException::withMessages(['config' => 'Choose a Playwright config inside the connected repository.']);
        }
        $data['config'] = substr($path, strlen($root) + 1);
        $session->suites()->create($data);

        return redirect()->route('sessions.show', $session)->with('message', 'Suite added. Capture its before state before changing your feature.');
    }

    public function run(Request $request, TestSuite $suite): RedirectResponse
    {
        $data = $request->validate(['phase' => 'required|in:before,after']);
        DB::transaction(function () use ($suite, $data): void {
            $suite = TestSuite::whereKey($suite->id)->lockForUpdate()->firstOrFail();
            if ($suite->runs()->whereIn('status', ['queued', 'running'])->exists()) {
                throw ValidationException::withMessages(['suite' => 'This suite is already running.']);
            }
            $baseline = $suite->runs()->where('phase', 'before')->where('status', 'complete')->exists();
            if (($data['phase'] === 'before' && $baseline) || ($data['phase'] === 'after' && ! $baseline)) {
                throw ValidationException::withMessages(['suite' => $baseline ? 'The suite baseline is locked. Add another suite to start over.' : 'Capture this suite’s before state first.']);
            }
            $run = $suite->runs()->create(['phase' => $data['phase'], 'status' => 'queued']);
            RunTestSuite::dispatch($run->id);
        });

        return redirect()->route('sessions.show', $suite->change_session_id);
    }

    public function artifact(SuiteRun $run, string $file): BinaryFileResponse
    {
        $root = realpath(storage_path('app/private/suites/'.$run->id.'/assets'));
        $path = $root ? realpath($root.'/'.$file) : false;
        $allowed = collect($run->report['tests'] ?? [])->flatMap(fn ($test) => $test['attachments'] ?? [])->contains(fn ($a) => $a['file'] === $file);
        abort_unless($allowed && $root && $path && is_file($path) && str_starts_with($path, $root.DIRECTORY_SEPARATOR), 404);
        $headers = ['X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store'];
        if (str_ends_with($file, '.png')) {
            return response()->file($path, $headers + ['Content-Type' => 'image/png']);
        }

        if (str_ends_with($file, '.webm')) {
            return response()->file($path, $headers + ['Content-Type' => 'video/webm']);
        }

        return response()->download($path, $file, $headers);
    }
}
