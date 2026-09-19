<?php

namespace Database\Factories;

use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

class EnvironmentFactory extends Factory
{
    public function definition(): array
    {
        return ['project_id' => Project::factory(), 'name' => 'Local', 'base_url' => 'http://127.0.0.1:5175', 'allowed_origins' => [], 'runner_mode' => 'local', 'profile' => 'live'];
    }
}
