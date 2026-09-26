<?php

namespace App\Http\Controllers;

use App\Actions\CreateChangeSessionAction;
use App\Actions\SessionBaselineAction;
use App\Http\Requests\StoreSessionRequest;
use App\Models\ChangeSession;
use App\Models\Environment;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;

class SessionController extends Controller
{
    public function create(): View
    {
        $environments = Environment::with('project')->get();

        return $this->hub('session-form', compact('environments'));
    }

    public function store(StoreSessionRequest $request, CreateChangeSessionAction $action): RedirectResponse
    {
        $session = $action->handle($request->validated());

        return redirect()->route('sessions.show', $session);
    }

    public function show(ChangeSession $session): View
    {
        app(SessionBaselineAction::class)->handle($session);
        $session->refresh();
        $session->load('environment.project', 'runs', 'suites.runs');
        $active = $session->suites->contains(fn ($suite) => $suite->runs->contains(fn ($run) => in_array($run->status, ['queued', 'running']))) || $session->runs->contains(fn ($run) => in_array($run->status, ['queued', 'running']));

        return $this->hub('session', compact('session', 'active'));
    }
}
