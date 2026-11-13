<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('empresa_id')->nullable()->after('id')->constrained('empresas')->nullOnDelete();
            $table->foreignId('sucursal_id')->nullable()->after('empresa_id')->constrained('sucursales')->nullOnDelete();
            $table->string('rol')->default('cajero')->after('password'); // admin, gerente, cajero, inventario
            $table->boolean('activo')->default(true)->after('rol');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('empresa_id');
            $table->dropConstrainedForeignId('sucursal_id');
            $table->dropColumn(['rol', 'activo']);
        });
    }
};
