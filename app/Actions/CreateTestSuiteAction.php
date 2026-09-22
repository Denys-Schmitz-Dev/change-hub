<?php

namespace App\Actions;

use App\Models\ChangeSession;
use App\Models\TestSuite;

class CreateTestSuiteAction
{
    public function handle(ChangeSession $session, array $data): TestSuite
    {
        $root = realpath($session->profile['repository']);
        $data['config'] = substr(realpath($root.'/'.$data['config']), strlen($root) + 1);

        return $session->suites()->create($data);
    }
}
