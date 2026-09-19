<?php

namespace Database\Factories;

use App\Models\CaptureRun;
use Illuminate\Database\Eloquent\Factories\Factory;

class CaptureViewFactory extends Factory
{
    public function definition(): array
    {
        return ['capture_run_id' => CaptureRun::factory(), 'key' => 'desktop-live', 'status' => 'complete'];
    }
}
