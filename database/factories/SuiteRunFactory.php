<?php

namespace Database\Factories;

use App\Models\SuiteRun;
use App\Models\TestSuite;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SuiteRun>
 */
class SuiteRunFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'test_suite_id' => TestSuite::factory(), 'phase' => 'before', 'status' => 'queued',
        ];
    }
}
