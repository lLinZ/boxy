<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Cola de escaneos remotos: el teléfono inserta, la caja (PC) consume.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scanner_escaneos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('codigo', 100);
            $table->boolean('procesado')->default(false);
            $table->timestamps();

            $table->index(['user_id', 'procesado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scanner_escaneos');
    }
};
