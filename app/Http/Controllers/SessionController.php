<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSessionRequest;
use App\Models\ChangeSession;
use App\Models\Environment;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SessionController extends Controller
{
    public function create(Request $request): View
    {
        $environments = Environment::with('project')->get();

        return $this->hub('session-form', compact('environments'));
    }

    public function store(StoreSessionRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $environment = Environment::with('project')->findOrFail($data['environment_id']);
        $allowed = $environment->profile === 'resume' ? ['guest', 'pending', 'approved', 'denied', 'unavailable'] : ['live'];
        if (array_diff($data['scenarios'], $allowed)) {
            throw ValidationException::withMessages(['scenarios' => 'Choose visitor states matching the environment profile.']);
        }
        $profile = ['version' => 1, 'baseURL' => $environment->base_url, 'repository' => $environment->project->repository_path, 'runnerMode' => $environment->runner_mode, 'dockerNetwork' => $environment->docker_network, 'allowedOrigins' => $environment->allowed_origins, 'readySelector' => $environment->ready_selector, 'adapter' => $environment->profile, 'path' => $data['path'], 'devices' => $data['devices'], 'scenarios' => $data['scenarios']];
        $session = ChangeSession::create(['environment_id' => $environment->id, 'title' => $data['title'], 'profile' => $profile, 'profile_hash' => hash('sha256', json_encode($profile, JSON_THROW_ON_ERROR))]);

        return redirect()->route('sessions.show', $session);
    }

    public function show(Request $request, ChangeSession $session): View
    {
        $session->load('environment.project', 'runs.views.artifacts', 'suites.runs');
        $before = $session->runs->first(fn ($run) => $run->phase === 'before' && $run->status === 'complete');
        $afterRuns = $session->runs->where('phase', 'after')->values();
        $after = $afterRuns->firstWhere('id', (int) $request->query('run')) ?? $afterRuns->last();
        $keys = [];
        foreach ($session->profile['devices'] as $device) {
            foreach ($session->profile['scenarios'] as $scenario) {
                $keys[] = "$device-$scenario";
            }
        }
        $key = in_array($request->query('view'), $keys, true) ? $request->query('view') : $keys[0];
        $left = $before?->views->firstWhere('key', $key);
        $right = $after?->views->firstWhere('key', $key);
        $changes = [];
        if ($left?->observation && $right?->observation) {
            foreach (['headings', 'controls', 'links', 'text'] as $category) {
                $a = collect($left->observation[$category] ?? [])->keyBy(fn ($v) => json_encode($v));
                $b = collect($right->observation[$category] ?? [])->keyBy(fn ($v) => json_encode($v));
                $changes[$category] = ['added' => $b->diffKeys($a)->values()->all(), 'removed' => $a->diffKeys($b)->values()->all()];
            }
        }
        $active = $session->suites->contains(fn ($suite) => $suite->runs->contains(fn ($run) => in_array($run->status, ['queued', 'running']))) || $session->runs->contains(fn ($run) => in_array($run->status, ['queued', 'running']));

        return $this->hub('session', compact('session', 'before', 'after', 'afterRuns', 'keys', 'key', 'left', 'right', 'changes', 'active'));
    }
}
