<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ReglaNegocioException;
use App\Http\Controllers\Controller;
use App\Models\Categoria;
use App\Models\Empresa;
use App\Models\Inventario;
use App\Models\PrecioHistorial;
use App\Models\Producto;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductoController extends Controller
{
    public function __construct(private readonly StockService $stock) {}

    public function index(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;
        $sucursalId = $request->user()->sucursal_id;

        $query = Producto::where('empresa_id', $empresaId)
            ->with('categoria')
            // Adjunta el stock de la sucursal del usuario
            ->with(['inventarios' => fn ($q) => $q->where('sucursal_id', $sucursalId)]);

        if ($buscar = trim((string) $request->query('buscar'))) {
            $query->where(function ($q) use ($buscar) {
                $q->where('nombre', 'like', "%{$buscar}%")
                    ->orWhere('sku', 'like', "%{$buscar}%")
                    ->orWhere('codigo_barra', $buscar);
            });
        }
        if ($categoriaId = $request->integer('categoria_id')) {
            $query->where('categoria_id', $categoriaId);
        }
        if ($request->boolean('solo_activos', true)) {
            $query->where('activo', true);
        }

        $pagina = $query->orderBy('nombre')->paginate($this->porPagina($request));
        $this->ocultarCostos($request, $pagina->getCollection());

        return response()->json($pagina);
    }

    /**
     * Importación masiva de productos (desde Excel/CSV ya parseado en el cliente).
     * Cada fila se valida individualmente: las inválidas no abortan el resto.
     * Upsert por (empresa_id, sku); opcionalmente fija stock inicial vía kardex.
     */
    public function importar(Request $request): JsonResponse
    {
        $request->validate([
            'productos' => ['required', 'array', 'max:500'],
        ]);

        $user = $request->user();
        $empresaId = $user->empresa_id;
        $sucursalId = $user->sucursal_id;

        $creados = 0;
        $actualizados = 0;
        $errores = [];

        DB::transaction(function () use ($request, $user, $empresaId, $sucursalId, &$creados, &$actualizados, &$errores) {
            foreach ($request->input('productos') as $i => $fila) {
                $validador = Validator::make(is_array($fila) ? $fila : [], [
                    'sku' => ['required', 'string', 'max:50'],
                    'nombre' => ['required', 'string', 'max:255'],
                    'precio_venta_usd' => ['required', 'numeric', 'min:0', 'max:1000000'],
                    'precio_costo_usd' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
                    'tipo_iva' => ['nullable', 'in:general,reducido,exento'],
                    'categoria' => ['nullable', 'string', 'max:100'],
                    'codigo_barra' => ['nullable', 'string', 'max:50'],
                    'unidad' => ['nullable', 'string', 'max:20'],
                    'stock_inicial' => ['nullable', 'numeric', 'min:0'],
                    'stock_minimo' => ['nullable', 'numeric', 'min:0'],
                ]);

                if ($validador->fails()) {
                    // Fila inválida: se acumula (índice base 1) y se sigue con el resto
                    $errores[] = ['fila' => $i + 1, 'error' => $validador->errors()->first()];

                    continue;
                }

                $datos = $validador->validated();

                // Categoría por nombre: se crea si no existe (clave = slug por empresa)
                $atributos = [
                    'nombre' => $datos['nombre'],
                    'precio_venta_usd' => $datos['precio_venta_usd'],
                    'tipo_iva' => $datos['tipo_iva'] ?? 'general',
                    'unidad' => $datos['unidad'] ?? 'UND',
                ];

                if (! empty($datos['categoria'])) {
                    $categoria = Categoria::firstOrCreate(
                        ['empresa_id' => $empresaId, 'slug' => Str::slug($datos['categoria'])],
                        ['nombre' => $datos['categoria']],
                    );
                    $atributos['categoria_id'] = $categoria->id;
                }

                if (isset($datos['precio_costo_usd'])) {
                    $atributos['precio_costo_usd'] = $datos['precio_costo_usd'];
                }

                if (! empty($datos['codigo_barra'])) {
                    $atributos['codigo_barra'] = $datos['codigo_barra'];
                }

                $producto = Producto::firstOrNew(['empresa_id' => $empresaId, 'sku' => $datos['sku']]);
                $precioAnterior = $producto->exists ? (float) $producto->precio_venta_usd : null;
                $producto->fill($atributos)->save();
                $this->registrarPrecio($producto, $precioAnterior, $user->id, 'importacion');

                $producto->wasRecentlyCreated ? $creados++ : $actualizados++;

                // Stock inicial / mínimo en la sucursal del usuario
                if ($sucursalId && isset($datos['stock_inicial'])) {
                    // Fija el stock exacto y deja traza en el kardex
                    $actual = (float) (Inventario::where('sucursal_id', $sucursalId)->where('producto_id', $producto->id)->value('cantidad') ?? 0);
                    $delta = (float) $datos['stock_inicial'] - $actual;
                    if ($delta != 0.0) {
                        $this->stock->mover($sucursalId, $producto, $delta, 'ajuste', $user->id, 'Importación Excel');
                    }
                }
                if ($sucursalId && isset($datos['stock_minimo'])) {
                    Inventario::updateOrCreate(
                        ['sucursal_id' => $sucursalId, 'producto_id' => $producto->id],
                        ['stock_minimo' => $datos['stock_minimo']],
                    );
                }
            }
        });

        return response()->json([
            'creados' => $creados,
            'actualizados' => $actualizados,
            'errores' => $errores,
        ]);
    }

    /**
     * Métricas de rentabilidad por producto: margen, stock total y
     * desempeño de ventas de los últimos 30 días (2 queries, sin N+1).
     */
    public function metricas(Request $request): JsonResponse
    {
        $empresaId = $request->user()->empresa_id;

        // 1) Productos activos con categoría y stock total (todas las sucursales)
        $productos = Producto::where('empresa_id', $empresaId)
            ->where('activo', true)
            ->with('categoria:id,nombre')
            ->withSum('inventarios as stock_total', 'cantidad')
            ->get();

        // 2) Agregado de ventas emitidas de los últimos 30 días, por producto
        $ventas30d = DB::table('venta_items')
            ->join('ventas', 'ventas.id', '=', 'venta_items.venta_id')
            ->where('ventas.empresa_id', $empresaId)
            ->where('ventas.estado', 'emitida')
            ->where('ventas.fecha', '>=', now()->subDays(30))
            ->whereNotNull('venta_items.producto_id')
            ->groupBy('venta_items.producto_id')
            ->select(
                'venta_items.producto_id',
                DB::raw('SUM(venta_items.cantidad) as vendidos'),
                DB::raw('SUM(venta_items.total_usd) as ingresos'),
            )
            ->get()
            ->keyBy('producto_id');

        $metricas = $productos->map(function (Producto $producto) use ($ventas30d) {
            $venta = (float) $producto->precio_venta_usd;
            $costo = (float) $producto->precio_costo_usd;
            $gananciaUnitaria = $venta - $costo;

            $agregado = $ventas30d->get($producto->id);
            $vendidos = $agregado ? (float) $agregado->vendidos : 0.0;
            $ingresos = $agregado ? (float) $agregado->ingresos : 0.0;

            return [
                'id' => $producto->id,
                'nombre' => $producto->nombre,
                'sku' => $producto->sku,
                'categoria' => $producto->categoria?->nombre,
                'precio_costo_usd' => $costo,
                'precio_venta_usd' => $venta,
                'margen_pct' => $venta > 0 ? round(($venta - $costo) / $venta * 100, 1) : 0,
                'ganancia_usd' => round($gananciaUnitaria, 4),
                'stock' => (float) ($producto->stock_total ?? 0),
                'vendidos_30d' => $vendidos,
                'ingresos_30d_usd' => round($ingresos, 2),
                // Aproximación: unidades vendidas × ganancia unitaria al costo actual
                'ganancia_30d_usd' => round($vendidos * $gananciaUnitaria, 2),
            ];
        })->sortByDesc('ingresos_30d_usd')->values();

        return response()->json($metricas);
    }

    /**
     * Búsqueda por código de barras (pistola, cámara o teléfono).
     * Si no hay coincidencia exacta y la balanza está activa, interpreta las
     * etiquetas de balanza (EAN-13 que empiezan por 2): PLU + peso o precio.
     * En ese caso devuelve el producto con `cantidad_balanza`.
     */
    public function porCodigoBarra(Request $request, string $codigo): JsonResponse
    {
        $user = $request->user();
        $conStock = ['inventarios' => fn ($q) => $q->where('sucursal_id', $user->sucursal_id)];

        $producto = Producto::where('empresa_id', $user->empresa_id)
            ->where('activo', true)
            ->where('codigo_barra', $codigo)
            ->with($conStock)
            ->first();

        if (! $producto) {
            $etiqueta = self::leerEtiquetaBalanza($codigo, Empresa::findOrFail($user->empresa_id));
            if ($etiqueta) {
                $producto = Producto::where('empresa_id', $user->empresa_id)
                    ->where('activo', true)
                    ->where('codigo_balanza', $etiqueta['plu'])
                    ->with($conStock)
                    ->first();

                if ($producto) {
                    $cantidad = $etiqueta['tipo'] === 'peso'
                        ? $etiqueta['valor'] / 1000                                     // gramos → kg
                        : ((float) $producto->precio_venta_usd > 0
                            ? $etiqueta['valor'] / 100 / (float) $producto->precio_venta_usd // precio → cantidad
                            : 0);
                    $producto->cantidad_balanza = round($cantidad, 3);
                }
            }
        }

        abort_if(! $producto, 404, 'Código no encontrado.');
        $this->ocultarCostos($request, collect([$producto]));

        return response()->json($producto);
    }

    /**
     * Interpreta una etiqueta de balanza: [prefijo 2 dígitos][PLU][valor][dígito verificador].
     *
     * @return array{plu: string, valor: int, tipo: string}|null
     */
    public static function leerEtiquetaBalanza(string $codigo, Empresa $empresa): ?array
    {
        if (! $empresa->ajuste('balanza_activa') || ! preg_match('/^\d{13}$/', $codigo)) {
            return null;
        }

        $prefijos = array_filter(array_map('trim', explode(',', (string) $empresa->ajuste('balanza_prefijos'))));
        if (! in_array(substr($codigo, 0, 2), $prefijos, true)) {
            return null;
        }

        // Dígito verificador EAN-13
        $suma = 0;
        for ($i = 0; $i < 12; $i++) {
            $suma += (int) $codigo[$i] * ($i % 2 === 0 ? 1 : 3);
        }
        if ((10 - $suma % 10) % 10 !== (int) $codigo[12]) {
            return null;
        }

        $digitosPlu = max(4, min(6, (int) $empresa->ajuste('balanza_digitos_plu')));
        $plu = substr($codigo, 2, $digitosPlu);
        $valor = (int) substr($codigo, 2 + $digitosPlu, 10 - $digitosPlu);

        return ['plu' => ltrim($plu, '0') ?: '0', 'valor' => $valor, 'tipo' => $empresa->ajuste('balanza_tipo')];
    }

    public function show(Request $request, Producto $producto): JsonResponse
    {
        $this->autorizar($request, $producto);
        $producto->load('categoria', 'inventarios');
        $this->ocultarCostos($request, collect([$producto]));

        return response()->json($producto);
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validar($request);
        $datos['empresa_id'] = $request->user()->empresa_id;

        $producto = Producto::create($datos);

        return response()->json($producto, 201);
    }

    public function update(Request $request, Producto $producto): JsonResponse
    {
        $this->autorizar($request, $producto);
        $datos = $this->validar($request, $producto->id);

        $precioAnterior = (float) $producto->precio_venta_usd;
        if (! $request->user()->puede('precios.gestionar') && round((float) $datos['precio_venta_usd'], 4) !== round($precioAnterior, 4)) {
            throw new ReglaNegocioException('No tienes permiso para cambiar precios.', 403);
        }

        $producto->update($datos);
        $this->registrarPrecio($producto, $precioAnterior, $request->user()->id, 'manual');

        return response()->json($producto);
    }

    public function destroy(Request $request, Producto $producto): JsonResponse
    {
        $this->autorizar($request, $producto);
        $producto->update(['activo' => false]); // baja lógica para no romper históricos

        return response()->json(['message' => 'Producto desactivado.']);
    }

    /** Sube/reemplaza la foto del producto (se guarda en storage público). */
    public function subirImagen(Request $request, Producto $producto): JsonResponse
    {
        $this->autorizar($request, $producto);

        $request->validate([
            'imagen' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        // Borra la foto anterior si vivía en nuestro storage
        if ($producto->imagen_path && str_starts_with($producto->imagen_path, '/storage/')) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $producto->imagen_path));
        }

        $path = $request->file('imagen')->store("productos/{$producto->empresa_id}", 'public');
        $producto->update(['imagen_path' => '/storage/'.$path]);

        return response()->json($producto);
    }

    /**
     * Cambio masivo de precios. Con `aplicar=false` solo devuelve la vista previa.
     *
     * Operaciones: porcentaje (sube/baja X %), margen (precio = costo con X % de margen
     * sobre la venta) o fijo (suma/resta X USD). Redondeo opcional a 0.05, 0.10, 0.50 o 1.
     */
    public function preciosMasivos(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'alcance' => ['required', 'in:todos,categoria,productos'],
            'categoria_id' => ['required_if:alcance,categoria', 'nullable', 'integer'],
            'producto_ids' => ['required_if:alcance,productos', 'nullable', 'array', 'max:2000'],
            'producto_ids.*' => ['integer'],
            'operacion' => ['required', 'in:porcentaje,margen,fijo'],
            'valor' => ['required', 'numeric', 'min:-99', 'max:1000'],
            'redondeo' => ['nullable', 'in:0,0.01,0.05,0.1,0.5,1'],
            'aplicar' => ['nullable', 'boolean'],
        ]);

        $user = $request->user();
        $query = Producto::where('empresa_id', $user->empresa_id)->where('activo', true);
        if ($datos['alcance'] === 'categoria') {
            $query->where('categoria_id', $datos['categoria_id']);
        } elseif ($datos['alcance'] === 'productos') {
            $query->whereIn('id', $datos['producto_ids']);
        }

        $valor = (float) $datos['valor'];
        $redondeo = (float) ($datos['redondeo'] ?? 0);
        if ($datos['operacion'] === 'margen' && $valor >= 100) {
            throw new ReglaNegocioException('El margen debe ser menor a 100 %.');
        }

        $cambios = $query->orderBy('nombre')->get()->map(function (Producto $p) use ($datos, $valor, $redondeo) {
            $actual = (float) $p->precio_venta_usd;
            $costo = (float) $p->precio_costo_usd;
            $nuevo = match ($datos['operacion']) {
                'porcentaje' => $actual * (1 + $valor / 100),
                'margen' => $costo > 0 ? $costo / (1 - $valor / 100) : $actual,
                'fijo' => $actual + $valor,
            };
            if ($redondeo > 0) {
                $nuevo = ceil(round($nuevo / $redondeo, 6)) * $redondeo; // hacia arriba, a la fracción elegida
            }
            $nuevo = round(max(0.01, $nuevo), 4);

            return [
                'id' => $p->id,
                'nombre' => $p->nombre,
                'sku' => $p->sku,
                'costo_usd' => $costo,
                'precio_actual_usd' => $actual,
                'precio_nuevo_usd' => $nuevo,
                'margen_nuevo_pct' => $nuevo > 0 ? round(($nuevo - $costo) / $nuevo * 100, 1) : 0,
                'bajo_costo' => $costo > 0 && $nuevo < $costo,
            ];
        })->filter(fn ($c) => round($c['precio_nuevo_usd'], 4) !== round($c['precio_actual_usd'], 4))->values();

        if (! $request->boolean('aplicar')) {
            return response()->json(['aplicado' => false, 'cambios' => $cambios]);
        }

        DB::transaction(function () use ($cambios, $user) {
            foreach ($cambios as $c) {
                Producto::whereKey($c['id'])->update(['precio_venta_usd' => $c['precio_nuevo_usd']]);
                PrecioHistorial::create([
                    'producto_id' => $c['id'],
                    'user_id' => $user->id,
                    'precio_anterior_usd' => $c['precio_actual_usd'],
                    'precio_nuevo_usd' => $c['precio_nuevo_usd'],
                    'motivo' => 'masivo',
                ]);
            }
        });

        return response()->json(['aplicado' => true, 'cambios' => $cambios]);
    }

    /** Historial de precios de un producto. */
    public function historialPrecios(Request $request, Producto $producto): JsonResponse
    {
        $this->autorizar($request, $producto);

        return response()->json(
            PrecioHistorial::where('producto_id', $producto->id)->with('user:id,name')->latest('id')->limit(100)->get()
        );
    }

    private function registrarPrecio(Producto $producto, ?float $anterior, ?int $userId, string $motivo): void
    {
        $nuevo = (float) $producto->precio_venta_usd;
        if ($anterior !== null && round($anterior, 4) !== round($nuevo, 4)) {
            PrecioHistorial::create([
                'producto_id' => $producto->id,
                'user_id' => $userId,
                'precio_anterior_usd' => $anterior,
                'precio_nuevo_usd' => $nuevo,
                'motivo' => $motivo,
            ]);
        }
    }

    private function validar(Request $request, ?int $id = null): array
    {
        $empresaId = $request->user()->empresa_id;

        // El PLU de la etiqueta viene con ceros a la izquierda: se guarda sin ellos
        if ($request->filled('codigo_balanza')) {
            $request->merge(['codigo_balanza' => ltrim((string) $request->input('codigo_balanza'), '0') ?: '0']);
        }

        return $request->validate([
            'categoria_id' => ['nullable', Rule::exists('categorias', 'id')->where('empresa_id', $empresaId)],
            'sku' => ['required', 'string', 'max:50', Rule::unique('productos')->where('empresa_id', $empresaId)->ignore($id)],
            'codigo_barra' => ['nullable', 'string', 'max:50',
                Rule::unique('productos')->where('empresa_id', $empresaId)->where('activo', true)->ignore($id)],
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:2000'],
            'unidad' => ['nullable', 'string', 'max:20'],
            'precio_costo_usd' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'precio_venta_usd' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'tipo_iva' => ['required', 'in:general,reducido,exento'],
            'controla_stock' => ['boolean'],
            'pesable' => ['boolean'],
            'codigo_balanza' => ['nullable', 'string', 'regex:/^\d{1,6}$/',
                Rule::unique('productos')->where('empresa_id', $empresaId)->ignore($id)],
            'activo' => ['boolean'],
        ], [
            'codigo_barra.unique' => 'Otro producto activo ya usa ese código de barras.',
            'codigo_balanza.unique' => 'Otro producto ya usa ese código de balanza (PLU).',
        ]);
    }

    /** El costo y el margen solo los ve quien gestiona productos o reportes. */
    private function ocultarCostos(Request $request, $productos): void
    {
        $user = $request->user();
        if (! $user->puede('productos.gestionar') && ! $user->puede('reportes.ver')) {
            $productos->each(fn (Producto $p) => $p->makeHidden('precio_costo_usd'));
        }
    }

    private function autorizar(Request $request, Producto $producto): void
    {
        abort_unless($producto->empresa_id === $request->user()->empresa_id, 404);
    }
}
