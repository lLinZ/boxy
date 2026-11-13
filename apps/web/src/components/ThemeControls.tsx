import { Button, Tooltip } from '@heroui/react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/ThemeContext'

/**
 * Atajo de modo claro/oscuro para la barra superior. El color de acento y el
 * efecto vidrio son preferencias personales: viven en Mi perfil.
 */
export function ThemeControls() {
  const { mode, toggleMode } = useTheme()
  const oscuro = mode === 'dark'

  return (
    <Tooltip content={oscuro ? 'Modo claro' : 'Modo oscuro'} placement="bottom" delay={300}>
      <Button isIconOnly variant="light" radius="full" aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onPress={toggleMode}>
        {oscuro ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    </Tooltip>
  )
}
