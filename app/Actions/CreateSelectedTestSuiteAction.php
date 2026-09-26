<?php

namespace App\Actions;

use App\Models\ChangeSession;
use App\Models\TestSuite;
use Illuminate\Validation\ValidationException;

class CreateSelectedTestSuiteAction
{
    public function __construct(private DiscoverSuiteTestsAction $discovery) {}

    public function handle(ChangeSession $session, array $data): TestSuite
    {
        $catalog = $this->discovery->catalog($session, $data['config']);
        $selected = array_values(array_filter($catalog, fn (array $test): bool => in_array($test['key'], $data['test_keys'], true)));
        if (count($selected) !== count($data['test_keys'])) {
            throw ValidationException::withMessages(['test_keys' => 'Some selected tests have changed or disappeared. Reload the test list and select them again.']);
        }
        foreach ($selected as $test) {
            if (empty($test['listEntry']) || str_contains($test['listEntry'], "\n") || str_contains($test['listEntry'], "\r")) {
                throw ValidationException::withMessages(['test_keys' => 'This test title cannot be added with the picker. Use the advanced suite option.']);
            }
        }
        $root = realpath($session->profile['repository']);

        return $session->suites()->create([
            'name' => $data['name'],
            'config' => substr(realpath($root.'/'.$data['config']), strlen($root) + 1),
            'grep' => null,
            'test_selection' => $selected,
            'test_catalog' => $selected,
        ]);
    }
}
