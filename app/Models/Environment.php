<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Environment extends Model
{
    use HasFactory;

    protected $fillable = ['project_id', 'name', 'base_url', 'ready_selector', 'allowed_origins', 'runner_mode', 'docker_network', 'profile'];

    protected function casts(): array
    {
        return ['allowed_origins' => 'array'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ChangeSession::class);
    }
}
