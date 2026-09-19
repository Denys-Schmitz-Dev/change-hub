<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;

abstract class Controller
{
    protected function hub(string $page, array $props = []): View
    {
        return view('hub.app', ['payload' => ['page' => $page, 'props' => $props, 'csrf' => csrf_token(), 'old' => session()->getOldInput(), 'errors' => session('errors')?->all() ?? [], 'message' => session('message')]]);
    }
}
