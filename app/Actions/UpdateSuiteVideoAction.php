<?php

namespace App\Actions;

use App\Models\TestSuite;

class UpdateSuiteVideoAction
{
    public function handle(TestSuite $suite, ?array $selectedTests): void
    {
        $suite->update(['selected_tests' => $selectedTests, 'capture_video' => true]);
    }
}
