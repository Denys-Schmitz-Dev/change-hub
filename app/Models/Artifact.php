<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Artifact extends Model
{
    use HasFactory;

    protected $fillable = ['capture_view_id', 'name', 'path', 'sha256'];

    protected function casts(): array
    {
        return [];
    }

    public function view(): BelongsTo
    {
        return $this->belongsTo(CaptureView::class, 'capture_view_id');
    }
}
