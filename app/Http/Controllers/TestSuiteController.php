<?php

namespace App\Http\Controllers;

use App\Actions\CreateTestSuiteAction;
use App\Actions\DiscoverSuiteTestsAction;
use App\Actions\QueueSuiteRunAction;
use App\Actions\UpdateSuiteVideoAction;
use App\Http\Requests\CaptureRequest;
use App\Http\Requests\StoreTestSuiteRequest;
use App\Http\Requests\UpdateSuiteVideoRequest;
use App\Models\ChangeSession;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TestSuiteController extends Controller
{
    public function updateVideo(UpdateSuiteVideoRequest $request, TestSuite $suite, UpdateSuiteVideoAction $action): RedirectResponse
    {
        $action->handle($suite, $request->validated('mode') === 'all' ? null : $request->validated('selected_tests', []));

        return redirect()->route('sessions.show', $suite->change_session_id);
    }

    public function discover(TestSuite $suite, DiscoverSuiteTestsAction $action): RedirectResponse
    {
        $action->handle($suite);

        return redirect()->route('sessions.show', $suite->change_session_id);
    }

    public function store(StoreTestSuiteRequest $request, ChangeSession $session, CreateTestSuiteAction $action): RedirectResponse
    {
        $action->handle($session, $request->validated());

        return redirect()->route('sessions.show', $session)->with('message', 'Suite added. Capture its before state before changing your feature.');
    }

    public function run(CaptureRequest $request, TestSuite $suite, QueueSuiteRunAction $action): RedirectResponse
    {
        $action->handle($suite, $request->validated('phase'));

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
