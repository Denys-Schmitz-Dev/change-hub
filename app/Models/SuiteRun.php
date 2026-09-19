<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SuiteRun extends Model
{
    use HasFactory;

    protected $fillable = ['test_suite_id', 'phase', 'status', 'error', 'report'];

    protected function casts(): array
    {
        return ['report' => 'array'];
    }

    public function suite(): BelongsTo
    {
        return $this->belongsTo(TestSuite::class, 'test_suite_id');
    }
}
