// Corre los casos de apps/api/tests/fixtures/calculo_casos.json contra src/lib/calculo.ts
// (los mismos que usa PHPUnit), para garantizar que el POS calcula igual que el servidor.
// Uso: node scripts/probar-calculo.mjs   (Node 22.6+ quita los tipos de TypeScript solo)
import { readFileSync } from 'node:fs'
import { calcular } from '../src/lib/calculo.ts'

const casos = JSON.parse(readFileSync(new URL('../../api/tests/fixtures/calculo_casos.json', import.meta.url), 'utf8'))
let fallas = 0

function comparar(esperado, real, ruta) {
  for (const [clave, valor] of Object.entries(esperado)) {
    const donde = `${ruta}.${clave}`
    if (!(clave in real)) { fallas++; console.log(`  ✗ falta ${donde}`); continue }
    if (valor !== null && typeof valor === 'object') comparar(valor, real[clave], donde)
    else if (typeof valor === 'boolean' || valor === null) {
      if (real[clave] !== valor) { fallas++; console.log(`  ✗ ${donde}: esperado ${valor}, real ${real[clave]}`) }
    } else if (Math.abs(Number(valor) - Number(real[clave])) > 0.0001) {
      fallas++; console.log(`  ✗ ${donde}: esperado ${valor}, real ${real[clave]}`)
    }
  }
}

for (const c of casos) {
  const antes = fallas
  comparar(c.esperado, calcular(c.lineas, c.promociones, c.pagos, c.tasa, c.cobra_igtf), '')
  console.log(`${fallas === antes ? '✓' : '✗'} ${c.nombre}`)
}
console.log(fallas ? `\n${fallas} diferencia(s)` : `\nOK: ${casos.length} casos iguales al servidor`)
process.exit(fallas ? 1 : 0)
