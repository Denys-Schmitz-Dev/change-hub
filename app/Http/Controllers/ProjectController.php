<?php

namespace App\Http\Controllers;

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

    public function store(StoreProjectRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['repository_path'] = realpath($data['repository_path']);
        $project = Project::create($data);

        return redirect()->route('environments.create', $project);
    }

    public function environment(Project $project): View
    {
        return $this->hub('environment', compact('project'));
    }

    public function storeEnvironment(StoreEnvironmentRequest $request, Project $project): RedirectResponse
    {
        $data = $request->validated();
        $data['base_url'] = rtrim($data['base_url'], '/');
        $data['allowed_origins'] = array_values(array_unique(array_map(fn ($v) => rtrim($v, '/'), preg_split('/\s+/', trim($data['allowed_origins'] ?? ''), -1, PREG_SPLIT_NO_EMPTY))));
        $environment = $project->environments()->create($data);

        return redirect()->route('sessions.create', ['environment' => $environment->id]);
    }
}
