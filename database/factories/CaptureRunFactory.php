<?php

namespace Database\Factories;

use App\Models\ChangeSession;
use Illuminate\Database\Eloquent\Factories\Factory;

class CaptureRunFactory extends Factory
{
    public function definition(): array
    {
        return ['change_session_id' => ChangeSession::factory(), 'phase' => 'before', 'status' => 'queued'];
    }
}
