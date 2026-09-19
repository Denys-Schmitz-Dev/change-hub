<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'repository_path', 'playwright_config'];

    protected function casts(): array
    {
        return [];
    }

    public function environments(): HasMany
    {
        return $this->hasMany(Environment::class);
    }
}
