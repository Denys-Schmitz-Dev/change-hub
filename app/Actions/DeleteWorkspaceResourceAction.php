<?php

namespace App\Actions;

use App\Models\ChangeSession;
use App\Models\Project;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;

class DeleteWorkspaceResourceAction
{
    public function session(ChangeSession $session): void
    {
        [$captureIds, $suiteRunIds] = DB::transaction(function () use ($session): array {
            $session = ChangeSession::whereKey($session->id)->lockForUpdate()->firstOrFail();
            if ($this->hasActiveWork($session)) {
                throw ValidationException::withMessages(['delete' => 'Wait for queued or running work to finish before deleting this session.']);
            }
            $captureIds = $session->runs()->pluck('id')->all();
            $suiteRunIds = $session->suites()->with('runs:id,test_suite_id')->get()->flatMap->runs->pluck('id')->all();
            $session->delete();

            return [$captureIds, $suiteRunIds];
        });
        $this->deleteArtifacts($captureIds, $suiteRunIds);
    }

    public function project(Project $project): void
    {
        [$captureIds, $suiteRunIds] = DB::transaction(function () use ($project): array {
            $project = Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $sessions = ChangeSession::whereHas('environment', fn ($query) => $query->where('project_id', $project->id))->with('runs:id,change_session_id', 'suites.runs:id,test_suite_id')->get();
            if ($sessions->contains(fn (ChangeSession $session): bool => $this->hasActiveWork($session))) {
                throw ValidationException::withMessages(['delete' => 'Wait for queued or running work to finish before deleting this project.']);
            }
            $captureIds = $sessions->flatMap->runs->pluck('id')->all();
            $suiteRunIds = $sessions->flatMap->suites->flatMap->runs->pluck('id')->all();
            $project->delete();

            return [$captureIds, $suiteRunIds];
        });
        $this->deleteArtifacts($captureIds, $suiteRunIds);
    }

    private function hasActiveWork(ChangeSession $session): bool
    {
        return $session->runs()->whereIn('status', ['queued', 'running'])->exists()
            || $session->suites()->whereHas('runs', fn ($query) => $query->whereIn('status', ['queued', 'running']))->exists();
    }

    /** @param int[] $captureIds @param int[] $suiteRunIds */
    private function deleteArtifacts(array $captureIds, array $suiteRunIds): void
    {
        foreach ($captureIds as $id) {
            File::deleteDirectory(storage_path('app/private/captures/'.$id));
        }
        foreach ($suiteRunIds as $id) {
            File::deleteDirectory(storage_path('app/private/suites/'.$id));
        }
    }
}
