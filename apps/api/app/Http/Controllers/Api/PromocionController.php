<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Promocion;
use App\Services\PromocionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Promociones automáticas. El POS las aplica al instante y el servidor las
 * vuelve a calcular al registrar la venta (CalculadoraVenta).
 */
class PromocionController extends Controller
{
    public function __construct(private readonly PromocionService $promociones) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            Promocion::where('empresa_id', $request->user()->empresa_id)
                ->with(['producto:id,nombre', 'categoria:id,nombre'])
                ->orderByDesc('activo')->orderByDesc('id')
                ->get()
        );
    }

    /** Promociones vigentes hoy (las usa el POS). */
    public function vigentes(Request $request): JsonResponse
    {
        return response()->json($this->promociones->vigentes($request->user()->empresa_id));
    }

    public function store(Request $request): JsonResponse
    {
        $promocion = Promocion::create($this->validar($request) + ['empresa_id' => $request->user()->empresa_id]);

        return response()->json($promocion, 201);
    }

    public function update(Request $request, Promocion $promocion): JsonResponse
    {
        $this->autorizar($request, $promocion);
        $promocion->update($this->validar($request));

        return response()->json($promocion);
    }

    public function destroy(Request $request, Promocion $promocion): JsonResponse
    {
        $this->autorizar($request, $promocion);
        $promocion->delete();

        return response()->json(['message' => 'Promoción eliminada.']);
    }

    private function validar(Request $request): array
    {
        $empresaId = $request->user()->empresa_id;

        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'tipo' => ['required', 'in:porcentaje,nxm,precio_cantidad'],
            'producto_id' => ['nullable', Rule::exists('productos', 'id')->where('empresa_id', $empresaId),
                Rule::requiredIf(fn () => in_array($request->input('tipo'), ['nxm', 'precio_cantidad'], true))],
            'categoria_id' => ['nullable', Rule::exists('categorias', 'id')->where('empresa_id', $empresaId)],
            'valor' => ['required_unless:tipo,nxm', 'nullable', 'numeric', 'min:0',
                Rule::when($request->input('tipo') === 'porcentaje', ['max:100'])],
            'lleva' => ['required_if:tipo,nxm', 'nullable', 'integer', 'min:2', 'max:100'],
            'paga' => ['required_if:tipo,nxm', 'nullable', 'integer', 'min:0', 'lt:lleva'],
            'cantidad_minima' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date', 'after_or_equal:desde'],
            'dias_semana' => ['nullable', 'array'],
            'dias_semana.*' => ['integer', 'between:0,6'],
            'activo' => ['boolean'],
        ], [
            'producto_id.required' => 'Esta promoción necesita un producto.',
            'paga.lt' => 'En "lleva N paga M", M debe ser menor que N.',
        ]);

        $datos['valor'] ??= 0;
        $datos['cantidad_minima'] ??= 1;

        return $datos;
    }

    private function autorizar(Request $request, Promocion $promocion): void
    {
        abort_unless($promocion->empresa_id === $request->user()->empresa_id, 404);
    }
}
