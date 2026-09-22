<?php

namespace App\Actions;

use App\Models\ChangeSession;
use App\Models\Environment;
use Illuminate\Support\Facades\DB;

class CreateChangeSessionAction
{
    public function handle(array $data): ChangeSession
    {
        $environment = Environment::with('project')->findOrFail($data['environment_id']);
        $profile = [
            'version' => 1,
            'baseURL' => $environment->base_url,
            'repository' => $environment->project->repository_path,
            'runnerMode' => $environment->runner_mode,
            'dockerNetwork' => $environment->docker_network,
            'allowedOrigins' => $environment->allowed_origins,
            'readySelector' => $environment->ready_selector,
            'adapter' => $environment->profile,
            'path' => $data['path'],
            'devices' => $data['devices'],
            'scenarios' => $data['scenarios'],
        ];

        return DB::transaction(function () use ($data, $environment, $profile): ChangeSession {
            $session = ChangeSession::create([
                'environment_id' => $environment->id,
                'title' => $data['title'],
                'profile' => $profile,
                'profile_hash' => hash('sha256', json_encode($profile, JSON_THROW_ON_ERROR)),
            ]);
            if ($environment->project->playwright_config) {
                $session->suites()->create([
                    'name' => $environment->project->suite_name ?? 'E2E tests',
                    'config' => $environment->project->playwright_config,
                    'grep' => $environment->project->test_filter,
                ]);
            }

            return $session;
        });
    }
}
