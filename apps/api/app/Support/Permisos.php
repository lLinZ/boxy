<?php

namespace App\Support;

use App\Models\User;

/**
 * Permisos por rol, en un solo lugar. El servidor los exige con el middleware
 * `permiso:...` y la web los recibe en /me para armar el menú.
 *
 * Roles de empresa: admin, gerente, cajero, inventario.
 * El super_admin (dueño del SaaS) no opera empresas: solo tasas y panel admin.
 */
class Permisos
{
    public const MAPA = [
        // Ventas y caja
        'ventas.crear' => ['admin', 'gerente', 'cajero'],
        'ventas.ver_todas' => ['admin', 'gerente'],        // si no, solo las de su sucursal
        'ventas.descuento' => ['admin', 'gerente'],        // cajero: con PIN de supervisor
        'ventas.item_libre' => ['admin', 'gerente'],       // líneas sin producto del catálogo
        'ventas.anular' => ['admin', 'gerente'],           // cajero: con PIN de supervisor
        'ventas.devolver' => ['admin', 'gerente'],         // cajero: con PIN de supervisor
        'caja.operar' => ['admin', 'gerente', 'cajero'],
        'caja.supervisar' => ['admin', 'gerente'],         // ver/cerrar turnos ajenos, ver esperado

        // Catálogo, inventario y compras
        'productos.gestionar' => ['admin', 'gerente', 'inventario'],
        'precios.gestionar' => ['admin', 'gerente'],
        'inventario.movimientos' => ['admin', 'gerente', 'inventario'],
        'compras.gestionar' => ['admin', 'gerente', 'inventario'],
        'promociones.gestionar' => ['admin', 'gerente'],

        // Clientes (CRM) y fiado
        'clientes.gestionar' => ['admin', 'gerente', 'cajero'],
        'clientes.eliminar' => ['admin', 'gerente'],
        'fiado.configurar' => ['admin', 'gerente'],        // habilitar crédito y límite
        'fiado.abonar' => ['admin', 'gerente', 'cajero'],
        'fiado.exceder_limite' => ['admin', 'gerente'],    // cajero: con PIN de supervisor

        // Reportes y administración
        'reportes.ver' => ['admin', 'gerente'],            // dashboard, monitor, análisis, costos
        'tasas.sincronizar' => ['admin', 'gerente', 'super_admin'],
        'tasas.editar' => ['super_admin'],                 // en modo dedicado también admin
        'usuarios.gestionar' => ['admin'],
        'empresa.configurar' => ['admin'],
        'respaldos.gestionar' => ['super_admin'],          // en modo dedicado también admin
        'licencia.gestionar' => ['admin'],
    ];

    /** Permisos que en una instalación dedicada (una sola tienda) también tiene el admin. */
    private const EXTRA_DEDICADO = ['tasas.editar', 'respaldos.gestionar'];

    public static function puede(?User $user, string $permiso): bool
    {
        if (! $user || ! $user->activo) {
            return false;
        }

        $roles = self::MAPA[$permiso] ?? [];

        if (in_array($user->rol, $roles, true)) {
            return true;
        }

        return $user->rol === 'admin'
            && config('boxy.modo') === 'dedicado'
            && in_array($permiso, self::EXTRA_DEDICADO, true);
    }

    /** Lista de permisos del usuario (para la web). */
    public static function de(User $user): array
    {
        return array_values(array_filter(
            array_keys(self::MAPA),
            fn (string $permiso) => self::puede($user, $permiso),
        ));
    }
}
