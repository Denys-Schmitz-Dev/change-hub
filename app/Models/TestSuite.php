<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestSuite extends Model
{
    use HasFactory;

    protected $fillable = ['change_session_id', 'name', 'config', 'grep', 'capture_video', 'test_catalog', 'selected_tests', 'test_selection'];

    protected function casts(): array
    {
        return ['capture_video' => 'boolean', 'test_catalog' => 'array', 'selected_tests' => 'array', 'test_selection' => 'array'];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ChangeSession::class, 'change_session_id');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(SuiteRun::class)->orderBy('id');
    }
}
