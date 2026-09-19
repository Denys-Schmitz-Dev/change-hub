<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->text('repository_path');
            $t->text('playwright_config')->nullable();
            $t->timestamps();
        });
        Schema::create('environments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('project_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->text('base_url');
            $t->text('ready_selector')->nullable();
            $t->json('allowed_origins');
            $t->string('runner_mode')->default('local');
            $t->string('docker_network')->nullable();
            $t->string('profile')->default('live');
            $t->timestamps();
        });
        Schema::create('change_sessions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('environment_id')->constrained()->cascadeOnDelete();
            $t->string('title');
            $t->json('profile');
            $t->string('profile_hash', 64);
            $t->timestamps();
        });
        Schema::create('capture_runs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('change_session_id')->constrained()->cascadeOnDelete();
            $t->string('phase');
            $t->string('status')->default('queued')->index();
            $t->text('error')->nullable();
            $t->json('metadata')->nullable();
            $t->timestamp('started_at')->nullable();
            $t->timestamp('completed_at')->nullable();
            $t->timestamps();
        });
        Schema::create('capture_views', function (Blueprint $t) {
            $t->id();
            $t->foreignId('capture_run_id')->constrained()->cascadeOnDelete();
            $t->string('key');
            $t->string('status');
            $t->json('observation')->nullable();
            $t->json('events')->nullable();
            $t->text('error')->nullable();
            $t->unique(['capture_run_id', 'key']);
            $t->timestamps();
        });
        Schema::create('artifacts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('capture_view_id')->constrained()->cascadeOnDelete();
            $t->string('name');
            $t->text('path');
            $t->string('sha256', 64);
            $t->unique(['capture_view_id', 'name']);
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['artifacts', 'capture_views', 'capture_runs', 'change_sessions', 'environments', 'projects'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
