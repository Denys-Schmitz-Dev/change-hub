<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CaptureRun extends Model
{
    use HasFactory;

    protected $fillable = ['change_session_id', 'phase', 'status', 'error', 'metadata', 'started_at', 'completed_at'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'started_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ChangeSession::class, 'change_session_id');
    }

    public function views(): HasMany
    {
        return $this->hasMany(CaptureView::class);
    }
}
