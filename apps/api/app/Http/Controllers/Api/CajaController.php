<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TurnoCaja;
use App\Services\CajaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Caja por turnos: abrir con fondo, ver el resumen (reporte X) y cerrar con
 * arqueo (reporte Z no fiscal). El cajero cuenta a ciegas: no ve el efectivo
 * esperado hasta cerrar; el supervisor sí.
 */
class CajaController extends Controller
{
    public function __construct(private readonly CajaService $caja) {}

    /** Turno abierto del usuario (o null) con su resumen. */
    public function actual(Request $request): JsonResponse
    {
        $turno = $this->caja->abierto($request->user());

        return response()->json([
            'turno' => $turno,
            'resumen' => $turno ? $this->resumenVisible($request, $turno) : null,
        ]);
    }

    public function abrir(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'fondo_bs' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'fondo_usd' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'observacion' => ['nullable', 'string', 'max:255'],
        ]);

        $turno = $this->caja->abrir(
            $request->user(),
            (float) ($datos['fondo_bs'] ?? 0),
            (float) ($datos['fondo_usd'] ?? 0),
            $datos['observacion'] ?? null,
        );

        return response()->json($turno, 201);
    }

    /** Historial de turnos: el cajero ve los suyos; el supervisor, los de la empresa. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = TurnoCaja::where('empresa_id', $user->empresa_id)
            ->with(['user:id,name', 'sucursal:id,nombre', 'cerradoPor:id,name'])
            ->latest('abierto_el');

        if (! $user->puede('caja.supervisar')) {
            $query->where('user_id', $user->id);
        }
        if ($estado = $request->query('estado')) {
            $query->where('estado', $estado);
        }

        $pagina = $query->paginate($this->porPagina($request, 20));
        if (! $user->puede('caja.supervisar')) {
            // El cajero no ve el esperado de turnos abiertos (arqueo a ciegas)
            $pagina->getCollection()->each(fn (TurnoCaja $t) => $t->estaAbierto() && $t->makeHidden(['esperado_bs', 'esperado_usd']));
        }
        $pagina->getCollection()->each(fn (TurnoCaja $t) => $t->makeHidden('resumen'));

        return response()->json($pagina);
    }

    public function show(Request $request, TurnoCaja $turno): JsonResponse
    {
        $this->autorizar($request, $turno);

        return response()->json([
            'turno' => $turno->load(['user:id,name', 'sucursal:id,nombre', 'cerradoPor:id,name'])->makeHidden('resumen'),
            'resumen' => $turno->estaAbierto() ? $this->resumenVisible($request, $turno) : $turno->resumen,
        ]);
    }

    public function cerrar(Request $request, TurnoCaja $turno): JsonResponse
    {
        $this->autorizar($request, $turno);
        $datos = $request->validate([
            'contado_bs' => ['required', 'numeric', 'min:0', 'max:999999999'],
            'contado_usd' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'observacion' => ['nullable', 'string', 'max:255'],
        ]);

        $turno = $this->caja->cerrar($turno, $request->user(), (float) $datos['contado_bs'],
            (float) $datos['contado_usd'], $datos['observacion'] ?? null);

        return response()->json([
            'turno' => $turno->load(['user:id,name', 'sucursal:id,nombre', 'cerradoPor:id,name'])->makeHidden('resumen'),
            'resumen' => $turno->resumen,
        ]);
    }

    private function resumenVisible(Request $request, TurnoCaja $turno): array
    {
        $resumen = $this->caja->resumen($turno);
        if (! $request->user()->puede('caja.supervisar')) {
            unset($resumen['efectivo']);
        }

        return $resumen;
    }

    /** Dueño del turno o supervisor de la misma empresa. */
    private function autorizar(Request $request, TurnoCaja $turno): void
    {
        $user = $request->user();
        abort_unless($turno->empresa_id === $user->empresa_id, 404);
        abort_unless($turno->user_id === $user->id || $user->puede('caja.supervisar'), 403);
    }
}
