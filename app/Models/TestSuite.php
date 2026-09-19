<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestSuite extends Model
{
    use HasFactory;

    protected $fillable = ['change_session_id', 'name', 'config', 'grep'];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ChangeSession::class, 'change_session_id');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(SuiteRun::class)->orderBy('id');
    }
}
