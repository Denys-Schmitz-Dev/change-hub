<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LocalOnly
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(in_array($request->ip(), ['127.0.0.1', '::1'], true) && in_array($request->getHost(), ['127.0.0.1', 'localhost', '[::1]'], true), 403, 'Change Hub is local-only.');
        if ($origin = $request->header('Origin')) {
            abort_unless($origin === $request->getSchemeAndHttpHost(), 403, 'Cross-origin access is not allowed.');
        }

        return $next($request);
    }
}
