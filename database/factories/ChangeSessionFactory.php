<?php

namespace Database\Factories;

use App\Models\Environment;
use Illuminate\Database\Eloquent\Factories\Factory;

class ChangeSessionFactory extends Factory
{
    public function definition(): array
    {
        return ['environment_id' => Environment::factory(), 'title' => 'Example change', 'profile' => ['version' => 1, 'devices' => ['desktop'], 'scenarios' => ['live'], 'path' => '/', 'baseURL' => 'http://127.0.0.1:5175', 'repository' => base_path(), 'allowedOrigins' => [], 'readySelector' => null, 'runnerMode' => 'local', 'dockerNetwork' => null, 'adapter' => 'live'], 'profile_hash' => str_repeat('a', 64)];
    }
}
