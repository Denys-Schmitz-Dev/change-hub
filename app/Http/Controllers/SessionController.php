<?php

namespace App\Http\Controllers;

use App\Actions\CreateChangeSessionAction;
use App\Actions\DeleteWorkspaceResourceAction;
use App\Actions\SessionBaselineAction;
use App\Actions\StoreReviewApprovalAction;
use App\Http\Requests\StoreReviewApprovalRequest;
use App\Http\Requests\StoreSessionRequest;
use App\Models\ChangeSession;
use App\Models\Environment;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;

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

    public function approve(StoreReviewApprovalRequest $request, ChangeSession $session, StoreReviewApprovalAction $action): RedirectResponse
    {
        $data = $request->validated();
        $run = $session->suites()->with('runs')->get()->flatMap->runs->firstWhere('id', $data['run_id']);
        if (! $run || $run->phase !== 'after' || $run->status !== 'complete') {
            throw ValidationException::withMessages(['approval' => 'Choose a completed after run from this session.']);
        }
        $action->store($session, $data);

        return redirect()->route('sessions.show', $session)->with('message', 'Review gap approved.');
    }

    public function revoke(StoreReviewApprovalRequest $request, ChangeSession $session, StoreReviewApprovalAction $action): RedirectResponse
    {
        $data = $request->safe()->only(['run_id', 'file']);
        $action->destroy($session, (int) $data['run_id'], $data['file']);

        return redirect()->route('sessions.show', $session)->with('message', 'Review approval revoked.');
    }

    public function destroy(ChangeSession $session, DeleteWorkspaceResourceAction $action): RedirectResponse
    {
        $action->session($session);

        return redirect()->route('home', ['view' => 'projects'])->with('message', 'Session deleted.');
    }
}
