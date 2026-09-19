<?php

namespace App\Http\Controllers;

use App\Models\Artifact;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ArtifactController extends Controller
{
    public function show(Artifact $artifact): BinaryFileResponse
    {
        $root = realpath(storage_path('app/private/captures'));
        $path = realpath(storage_path('app/private/'.$artifact->path));
        abort_unless($root && $path && str_starts_with($path, $root.DIRECTORY_SEPARATOR) && is_file($path), 404);
        $types = ['page.png' => 'image/png', 'observation.json' => 'application/json', 'events.json' => 'application/json', 'accessibility.yml' => 'text/plain', 'trace.zip' => 'application/zip'];
        abort_unless(isset($types[$artifact->name]), 404);

        return response()->file($path, ['Content-Type' => $types[$artifact->name], 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store']);
    }
}
