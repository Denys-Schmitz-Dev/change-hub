<?php

namespace Database\Factories;

use App\Models\ChangeSession;
use App\Models\TestSuite;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TestSuite>
 */
class TestSuiteFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'change_session_id' => ChangeSession::factory(), 'name' => 'Feature suite', 'config' => 'playwright.config.js', 'grep' => null,
        ];
    }
}
