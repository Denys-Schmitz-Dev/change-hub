<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChangeSession extends Model
{
    use HasFactory;

    protected $fillable = ['environment_id', 'title', 'profile', 'profile_hash', 'baseline'];

    protected function casts(): array
    {
        return ['profile' => 'array', 'baseline' => 'array'];
    }

    public function environment(): BelongsTo
    {
        return $this->belongsTo(Environment::class);
    }

    public function suites(): HasMany
    {
        return $this->hasMany(TestSuite::class);
    }

    public function runs(): HasMany
    {
        return $this->hasMany(CaptureRun::class)->orderBy('id');
    }
}
