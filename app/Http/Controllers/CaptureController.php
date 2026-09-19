<?php

namespace App\Http\Controllers;

use App\Models\ChangeSession;
use App\Services\CaptureService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CaptureController extends Controller
{
    public function store(Request $request, ChangeSession $session, CaptureService $captures): RedirectResponse
    {
        $data = $request->validate(['phase' => 'required|in:before,after']);
        $captures->queue($session, $data['phase']);

        return redirect()->route('sessions.show', $session)->with('message', 'Capture queued. The local worker will save the evidence.');
    }
}
