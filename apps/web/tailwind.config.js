import { heroui } from '@heroui/react'

// Acentos de Crotone = los colores personalizados de kobra (color base por acento).
// HeroUI v2 necesita la escala 50–900 completa, así que la generamos a partir del
// color base mezclándolo con blanco (tonos claros) y negro (tonos oscuros).
const ACCENTS = {
  verde: '#72DB5A',
  cian: '#00D7FF',
  azul: '#5DBFFF',
  violeta: '#A8ABFF',
  rosa: '#FF81B9',
  rojo: '#FF8289',
  naranja: '#FF9A00',
  lima: '#DCBE00',
}
const ACENTO_DEFECTO = 'verde'

const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const aHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mezclar = (rgb, objetivo, t) => rgb.map((v, i) => v + (objetivo[i] - v) * t)
const BLANCO = [255, 255, 255]
const NEGRO = [0, 0, 0]

// Escala tipo Tailwind: 500 = color base; más claros hacia blanco, más oscuros hacia negro.
const escala = (hex) => {
  const b = aRgb(hex)
  return {
    50: aHex(mezclar(b, BLANCO, 0.94)),
    100: aHex(mezclar(b, BLANCO, 0.86)),
    200: aHex(mezclar(b, BLANCO, 0.71)),
    300: aHex(mezclar(b, BLANCO, 0.5)),
    400: aHex(mezclar(b, BLANCO, 0.26)),
    500: aHex(b),
    600: aHex(mezclar(b, NEGRO, 0.18)),
    700: aHex(mezclar(b, NEGRO, 0.36)),
    800: aHex(mezclar(b, NEGRO, 0.52)),
    900: aHex(mezclar(b, NEGRO, 0.66)),
  }
}

// Texto legible sobre el color (oscuro si el acento es claro, blanco si es oscuro).
const legible = (hex) => {
  const [r, g, b] = aRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0f172a' : '#ffffff'
}

const primary = (name, mode) => {
  const s = escala(ACCENTS[name])
  const DEFAULT = mode === 'dark' ? s[400] : s[600] // pop en oscuro, contraste en claro
  return { ...s, DEFAULT, foreground: legible(DEFAULT) }
}

// Base light/dark = acento por defecto; además una variante light/dark por cada acento.
const themes = {
  light: { colors: { primary: primary(ACENTO_DEFECTO, 'light') } },
  dark: { colors: { primary: primary(ACENTO_DEFECTO, 'dark') } },
}
for (const name of Object.keys(ACCENTS)) {
  themes[`${name}-light`] = { extend: 'light', colors: { primary: primary(name, 'light') } }
  themes[`${name}-dark`] = { extend: 'dark', colors: { primary: primary(name, 'dark') } }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // npm anida @heroui/theme dentro de @heroui/react/node_modules; cubrimos ambas
    // ubicaciones e incluimos .mjs, donde realmente viven las clases del tema.
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx,mjs}',
    './node_modules/@heroui/*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx,mjs}',
  ],
  // Los nombres de tema (`violet-dark`, etc.) se construyen en runtime, así que Tailwind
  // no los ve en el código y los purgaría. El safelist obliga a generarlos todos.
  safelist: Object.keys(themes),
  theme: {
    extend: {
      fontFamily: {
        // UI/cuerpo: Inter (legibilidad). Marca/títulos/montos: Space Grotesk (carácter).
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  darkMode: 'class',
  plugins: [heroui({ themes })],
}
