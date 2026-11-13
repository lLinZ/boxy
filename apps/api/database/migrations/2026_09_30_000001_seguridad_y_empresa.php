<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fase 0: seguridad de usuarios y configuración de la empresa.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pin_supervisor')->nullable()->after('password'); // hash del PIN (4-6 dígitos)
            $table->boolean('debe_cambiar_clave')->default(false)->after('activo');
            $table->timestamp('ultimo_acceso_el')->nullable()->after('debe_cambiar_clave');
        });

        Schema::table('empresas', function (Blueprint $table) {
            // Preferencias de operación (ticket, IGTF, vuelto, fidelización, balanza…)
            $table->json('config')->nullable()->after('logo_path');
        });

        Schema::table('sucursales', function (Blueprint $table) {
            $table->unsignedBigInteger('proximo_numero_devolucion')->default(1)->after('proximo_numero_control');
            $table->unsignedBigInteger('proximo_numero_compra')->default(1)->after('proximo_numero_devolucion');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['pin_supervisor', 'debe_cambiar_clave', 'ultimo_acceso_el']);
        });
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn('config');
        });
        Schema::table('sucursales', function (Blueprint $table) {
            $table->dropColumn(['proximo_numero_devolucion', 'proximo_numero_compra']);
        });
    }
};
