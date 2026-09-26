<?php

namespace App\Http\Controllers;

use App\Actions\CreateSelectedTestSuiteAction;
use App\Actions\CreateTestSuiteAction;
use App\Actions\DiscoverSuiteTestsAction;
use App\Actions\ManageTestSuiteAction;
use App\Actions\QueueSuiteRunAction;
use App\Actions\UpdateSuiteVideoAction;
use App\Http\Requests\CaptureRequest;
use App\Http\Requests\DiscoverSessionTestsRequest;
use App\Http\Requests\StoreSelectedTestsRequest;
use App\Http\Requests\StoreTestSuiteRequest;
use App\Http\Requests\UpdateSuiteVideoRequest;
use App\Http\Requests\UpdateTestSuiteRequest;
use App\Models\ChangeSession;
use App\Models\SuiteRun;
use App\Models\TestSuite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TestSuiteController extends Controller
{
    public function catalog(DiscoverSessionTestsRequest $request, ChangeSession $session, DiscoverSuiteTestsAction $action): JsonResponse
    {
        return response()->json(['tests' => $action->catalog($session, $request->validated('config'))]);
    }

    public function addSelected(StoreSelectedTestsRequest $request, ChangeSession $session, CreateSelectedTestSuiteAction $action): RedirectResponse
    {
        $action->handle($session, $request->validated());

        return redirect()->route('sessions.show', $session)->with('message', 'Selected tests added. Capture their evidence when you are ready.');
    }

    public function update(UpdateTestSuiteRequest $request, TestSuite $suite, ManageTestSuiteAction $action): RedirectResponse
    {
        $action->handle($suite, $request->validated());

        return redirect()->route('sessions.show', $suite->change_session_id)->with('message', 'Suite updated.');
    }

    public function destroy(TestSuite $suite, ManageTestSuiteAction $action): RedirectResponse
    {
        $sessionId = $suite->change_session_id;
        $action->handle($suite, null);

        return redirect()->route('sessions.show', $sessionId)->with('message', 'Suite removed. Session baseline evidence is kept.');
    }

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

        return redirect()->route('sessions.show', $session)->with('message', 'Suite added. It will reuse the session baseline for matching tests.');
    }

    public function run(CaptureRequest $request, TestSuite $suite, QueueSuiteRunAction $action): RedirectResponse
    {
        $action->handle($suite, $request->validated('phase'));

        return redirect()->route('sessions.show', $suite->change_session_id);
    }

    public function artifact(SuiteRun $run, string $file): BinaryFileResponse
    {
        return $this->serveArtifact($run->id, $run->report, $file);
    }

    public function baselineArtifact(ChangeSession $session, int $runId, string $file): BinaryFileResponse
    {
        $run = collect($session->baseline['runs'] ?? [])->firstWhere('id', $runId);
        abort_unless($run, 404);

        return $this->serveArtifact($runId, $run['report'], $file);
    }

    private function serveArtifact(int $runId, ?array $report, string $file): BinaryFileResponse
    {
        $root = realpath(storage_path('app/private/suites/'.$runId.'/assets'));
        $path = $root ? realpath($root.'/'.$file) : false;
        $allowed = collect($report['tests'] ?? [])->flatMap(fn ($test) => $test['attachments'] ?? [])->contains(fn ($a) => $a['file'] === $file);
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
