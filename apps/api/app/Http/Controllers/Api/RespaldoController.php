<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RespaldoService;
use App\Support\Auditoria;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Respaldos de la base de datos. La base es una sola para toda la instalación,
 * así que en el SaaS solo el super-admin los maneja (en modo dedicado, también el admin).
 */
class RespaldoController extends Controller
{
    public function __construct(private readonly RespaldoService $respaldos) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'respaldos' => $this->respaldos->listar(),
            'conservar_dias' => (int) config('boxy.respaldos.conservar_dias'),
            'copia_extra' => (bool) config('boxy.respaldos.copiar_a'),
        ]);
    }

    public function store(): JsonResponse
    {
        $respaldo = $this->respaldos->crear();
        Auditoria::registrar('respaldo.creado', ['archivo' => $respaldo['archivo'] ?? null]);

        return response()->json($respaldo, 201);
    }

    public function descargar(string $archivo): BinaryFileResponse
    {
        try {
            $ruta = $this->respaldos->ruta($archivo);
        } catch (\RuntimeException) {
            abort(404);
        }
        // El respaldo trae todos los datos (clientes incluidos): que quede quién se lo llevó
        Auditoria::registrar('respaldo.descargado', ['archivo' => $archivo]);

        return response()->download($ruta, $archivo, ['Content-Type' => 'application/gzip']);
    }
}
