<?php

namespace App\Http\Controllers;

use App\Actions\CreateEnvironmentAction;
use App\Actions\CreateProjectAction;
use App\Actions\DeleteWorkspaceResourceAction;
use App\Http\Requests\StoreEnvironmentRequest;
use App\Http\Requests\StoreProjectRequest;
use App\Models\Project;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;

class ProjectController extends Controller
{
    public function create(): View
    {
        return $this->hub('project');
    }

    public function store(StoreProjectRequest $request, CreateProjectAction $action): RedirectResponse
    {
        $project = $action->handle($request->validated());

        return redirect()->route('environments.create', $project);
    }

    public function environment(Project $project): View
    {
        return $this->hub('environment', compact('project'));
    }

    public function storeEnvironment(StoreEnvironmentRequest $request, Project $project, CreateEnvironmentAction $action): RedirectResponse
    {
        $environment = $action->handle($project, $request->validated());

        return redirect()->route('sessions.create', ['environment' => $environment->id]);
    }

    public function destroy(Project $project, DeleteWorkspaceResourceAction $action): RedirectResponse
    {
        $action->project($project);

        return redirect()->route('home', ['view' => 'projects'])->with('message', 'Project and its sessions deleted.');
    }
}
