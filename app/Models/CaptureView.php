<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CaptureView extends Model
{
    use HasFactory;

    protected $fillable = ['capture_run_id', 'key', 'status', 'observation', 'events', 'error'];

    protected function casts(): array
    {
        return ['observation' => 'array', 'events' => 'array'];
    }

    public function artifacts(): HasMany
    {
        return $this->hasMany(Artifact::class);
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(CaptureRun::class, 'capture_run_id');
    }
}
