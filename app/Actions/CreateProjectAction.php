<?php

namespace App\Actions;

use App\Models\Project;

class CreateProjectAction
{
    public function handle(array $data): Project
    {
        $data['repository_path'] = realpath($data['repository_path']);

        return Project::create($data);
    }
}
