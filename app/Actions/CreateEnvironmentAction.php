<?php

namespace App\Actions;

use App\Models\Environment;
use App\Models\Project;

class CreateEnvironmentAction
{
    public function handle(Project $project, array $data): Environment
    {
        $data['base_url'] = rtrim($data['base_url'], '/');
        $origins = preg_split('/\s+/', trim($data['allowed_origins'] ?? ''), -1, PREG_SPLIT_NO_EMPTY);
        $data['allowed_origins'] = array_values(array_unique(array_map(fn (string $origin): string => rtrim($origin, '/'), $origins)));

        return $project->environments()->create($data);
    }
}
