<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/** Entrega segura de archivos subidos por los usuarios. */
class Archivos
{
    /** Tipos que se muestran en el navegador; cualquier otro se descarga como binario. */
    private const EN_LINEA = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
        'webp' => 'image/webp', 'pdf' => 'application/pdf',
    ];

    /**
     * Sirve un archivo del disco privado. Nunca con el tipo que diga el archivo:
     * un SVG o HTML subido como "imagen" se entrega como descarga, no se ejecuta.
     */
    public static function servirPrivado(?string $ruta, string $nombre): Response
    {
        abort_if(! $ruta || str_contains($ruta, '..') || ! Storage::disk('local')->exists($ruta), 404);

        $extension = strtolower(pathinfo($ruta, PATHINFO_EXTENSION));
        $tipo = self::EN_LINEA[$extension] ?? null;
        $disposicion = $tipo ? 'inline' : 'attachment';

        return Storage::disk('local')->response($ruta, "{$nombre}.{$extension}", [
            'Content-Type' => $tipo ?? 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ], $disposicion);
    }
}
