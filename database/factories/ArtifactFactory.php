<?php

namespace Database\Factories;

use App\Models\CaptureView;
use Illuminate\Database\Eloquent\Factories\Factory;

class ArtifactFactory extends Factory
{
    public function definition(): array
    {
        return ['capture_view_id' => CaptureView::factory(), 'name' => 'page.png', 'path' => 'captures/missing/page.png', 'sha256' => str_repeat('a', 64)];
    }
}
