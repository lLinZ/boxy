import { Button, Tooltip } from '@heroui/react'
import { Moon, Palette, Sparkles, Sun } from 'lucide-react'
import { ACCENTS, useTheme } from '../theme/ThemeContext'

export function ThemeControls() {
  const { mode, accent, glass, toggleMode, setAccent, toggleGlass } = useTheme()

  return (
    <div className="flex items-center gap-2">
      {/* Selector de color de tema (en pantallas angostas no cabe: se oculta) */}
      <div className="hidden items-center gap-2 rounded-full bg-default-100 px-3 py-1.5 md:flex">
        <Palette className="h-4 w-4 text-default-500" />
        {ACCENTS.map((a) => (
          <Tooltip key={a.key} content={a.label} placement="bottom" delay={300}>
            <button
              type="button"
              aria-label={`Tema ${a.label}`}
              onClick={() => setAccent(a.key)}
              className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${
                accent === a.key
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-default-100'
                  : ''
              }`}
              style={{ backgroundColor: a.color }}
            />
          </Tooltip>
        ))}
      </div>

      {/* Efecto glass on/off */}
      <Tooltip content={glass ? 'Desactivar efecto glass' : 'Activar efecto glass'} placement="bottom">
        <Button
          className="hidden sm:flex"
          isIconOnly
          variant={glass ? 'solid' : 'flat'}
          color={glass ? 'primary' : 'default'}
          radius="full"
          aria-label="Efecto glass"
          onPress={toggleGlass}
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </Tooltip>

      {/* Modo claro / oscuro */}
      <Button
        isIconOnly
        variant="flat"
        radius="full"
        aria-label="Cambiar modo claro/oscuro"
        onPress={toggleMode}
      >
        {mode === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </Button>
    </div>
  )
}
