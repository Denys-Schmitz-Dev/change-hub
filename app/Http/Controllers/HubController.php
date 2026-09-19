<?php

namespace App\Http\Controllers;

use App\Models\ChangeSession;
use App\Models\Project;
use Illuminate\Contracts\View\View;

class HubController extends Controller
{
    public function index(): View
    {
        return $this->hub('home', ['projects' => Project::with('environments')->get(), 'sessions' => ChangeSession::with('environment.project', 'runs')->latest()->get()]);
    }
}
