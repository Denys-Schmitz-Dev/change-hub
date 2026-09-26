<?php

namespace App\Http\Controllers;

use App\Models\ChangeSession;
use App\Models\Project;
use Illuminate\Contracts\View\View;

class HubController extends Controller
{
    public function index(): View
    {
        $sessions = ChangeSession::with('environment.project', 'runs', 'suites.runs:id,test_suite_id,phase,status,created_at')->latest()->get();
        foreach ($sessions as $session) {
            $session->setAttribute('baseline_available', ! empty($session->baseline['runs']));
            $session->makeHidden('baseline');
        }

        return $this->hub('home', ['projects' => Project::with('environments')->get(), 'sessions' => $sessions]);
    }
}
