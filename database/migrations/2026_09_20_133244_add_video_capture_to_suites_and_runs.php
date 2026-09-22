<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('test_suites', function (Blueprint $table) {
            $table->boolean('capture_video')->default(true);
        });
        Schema::table('suite_runs', function (Blueprint $table) {
            $table->boolean('capture_video')->default(true);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('test_suites', function (Blueprint $table) {
            $table->dropColumn('capture_video');
        });
        Schema::table('suite_runs', function (Blueprint $table) {
            $table->dropColumn('capture_video');
        });
    }
};
