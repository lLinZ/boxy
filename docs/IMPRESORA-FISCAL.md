# Impresora fiscal (ampliación opcional)

Boxy **no emite facturas fiscales**: sus comprobantes son documentos no fiscales. En
Venezuela, el comercio al detal emite la factura fiscal con una **máquina o impresora
fiscal homologada** (Providencia SNAT/2011/00141). Esta ampliación hace que Boxy le
mande cada venta a esa impresora para que ella imprima la factura, y guarda el número
fiscal que devuelve.

> **Estado: integración sin probar con equipo real.** El código genera los comandos del
> protocolo The Factory HKA y el puente los envía con el programa del fabricante, pero
> los largos de los campos, los códigos de los medios de pago y la lectura del número de
> factura dependen del modelo y de cómo lo programó el técnico. Hay que ajustarlos y
> probarlos con la impresora antes de usarla con clientes.

## Cómo funciona

```
POS ──venta──► API Boxy (estado_fiscal = pendiente)
                   ▲                 │
      resultado    │                 │ ventas pendientes + comandos TFHKA
  (número fiscal)  │                 ▼
               Puente fiscal (scripts/puente-fiscal.ps1, en la PC de la caja)
                   │
                   ▼
        IntTFHKA.exe (programa del fabricante) ──► impresora fiscal
```

1. Con **Mi empresa → Impresora fiscal → Enviar las ventas a la impresora fiscal**
   activado, cada venta nueva queda con `estado_fiscal = pendiente`.
2. El puente pregunta cada pocos segundos por las pendientes de **su sucursal**, escribe
   los comandos en `Factura.txt` y ejecuta `IntTFHKA.exe SendFileCmd(Factura.txt)`.
3. Si la impresora respondió bien, lee el número de la última factura y lo reporta; si
   no, reporta el error. En **Mi empresa** se ven las que quedaron con error y se pueden
   reintentar.
4. Una venta que ya salió por la impresora fiscal no se puede **anular** en Boxy: se
   registra una devolución y la nota de crédito fiscal se emite en la impresora.

## Requisitos

- Impresora fiscal homologada de la familia The Factory HKA (HKA80, SRP-812, etc.),
  instalada y programada por un técnico autorizado (RIF, encabezado, tasas de IVA y
  medios de pago).
- El programa del fabricante `IntTFHKA.exe` y su configuración de puerto (COM/USB).
- Windows PowerShell 5.1 (viene con Windows).

## Configuración

1. En **Mi empresa**, pulsar **Generar clave del puente** (sale una sola vez) y activar
   el envío a la impresora fiscal. La clave solo sirve para la cola fiscal: no da acceso
   a nada más del sistema.
2. Copiar `scripts/puente-fiscal.ps1` a la carpeta de `IntTFHKA.exe` y completar el
   bloque de configuración del principio: `$Api`, `$Clave` y las posiciones del número
   de factura dentro del estado S1 de tu modelo.
3. Revisar en `apps/api/app/Services/FiscalService.php`:
   - `FORMATO`: dígitos de precio y cantidad (formato estándar: precio 8+2, cantidad 5+3).
   - `MEDIOS_PAGO`: código de medio de pago de la impresora para cada método de Boxy.
4. Probar con la impresora en **modo de entrenamiento** si el modelo lo permite.

## Qué se envía

- `iR*` RIF o cédula del cliente (o `V00000000` para consumidor final) y `iS*` su nombre.
- Una línea por artículo: tasa (`!` 16 %, `"` 8 %, espacio exento), precio unitario en
  **bolívares sin IVA** (a tasa BCV, con el descuento aplicado), cantidad y descripción.
- `3` (subtotal) y los pagos: parciales con `2`+código+monto, el último con `1`+código.

El total de la impresora puede diferir en céntimos del de Boxy por redondeos; el
documento fiscal válido es el de la impresora.

## Pendientes conocidos

- IGTF: el cobro del 3 % en divisas en la impresora depende del firmware; revisar con el
  técnico cómo lo maneja tu modelo.
- Notas de crédito fiscales: se emiten desde la impresora (no automatizado en Boxy).
- Reportes X/Z fiscales: se sacan desde la impresora; los de Boxy son no fiscales.
