<?php

namespace App\Http\Controllers;

use App\Actions\QueueCaptureAction;
use App\Http\Requests\CaptureRequest;
use App\Models\ChangeSession;
use Illuminate\Http\RedirectResponse;

class CaptureController extends Controller
{
    public function store(CaptureRequest $request, ChangeSession $session, QueueCaptureAction $action): RedirectResponse
    {
        $action->handle($session, $request->validated('phase'));

        return redirect()->route('sessions.show', $session)->with('message', 'Test suites queued. Videos and developer evidence will appear as each run finishes.');
    }
}
