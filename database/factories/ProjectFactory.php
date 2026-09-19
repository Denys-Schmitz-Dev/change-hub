<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ProjectFactory extends Factory
{
    public function definition(): array
    {
        return ['name' => fake()->words(2, true), 'repository_path' => base_path()];
    }
}
