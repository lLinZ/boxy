<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Los comprobantes de pago de licencia (capturas con datos bancarios) vivían en
 * el disco público (/storage/comprobantes/...) sin autenticación. Se mueven al
 * disco privado; desde ahora se sirven por una ruta autenticada.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('pagos_licencia')
            ->where('comprobante_path', 'like', '/storage/%')
            ->orderBy('id')
            ->each(function ($pago) {
                $relativa = substr($pago->comprobante_path, strlen('/storage/'));

                if (Storage::disk('public')->exists($relativa)) {
                    Storage::disk('local')->put($relativa, Storage::disk('public')->get($relativa));
                    Storage::disk('public')->delete($relativa);
                }

                DB::table('pagos_licencia')->where('id', $pago->id)->update(['comprobante_path' => $relativa]);
            });
    }

    public function down(): void
    {
        // Sin vuelta atrás: no se vuelven a exponer los comprobantes.
    }
};
