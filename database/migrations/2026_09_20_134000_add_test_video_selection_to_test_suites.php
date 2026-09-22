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
            $table->json('test_catalog')->nullable();
            $table->json('selected_tests')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('test_suites', function (Blueprint $table) {
            $table->dropColumn(['test_catalog', 'selected_tests']);
        });
    }
};
