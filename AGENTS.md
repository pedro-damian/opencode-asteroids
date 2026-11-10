# AGENTS.md

## Qué es

Clon de Asteroids en HTML5 Canvas. Sin frameworks, sin bundler, sin dependencias, sin build: todo el juego vive en `game.js` y `index.html` solo lo hospeda. No existe `package.json`, tests, lint ni CI — no inventes comandos.

## Verificar cambios

No hay suite. Verificación real = ejecutar el juego:

```bash
npx serve .   # abre http://localhost:3000
```

o abrir `index.html` directo en el navegador. No requiere servidor ni pasos de setup (script clásico, no módulos).

## Convenciones

- **Un solo archivo**: mantener toda la lógica en `game.js`. No dividir en módulos ni agregar dependencias — es una decisión de diseño explícita del README.
- **Tamaño del canvas duplicado**: `W`/`H` (800×600) en `game.js` deben coincidir con `width`/`height` del `<canvas>` en `index.html`. Si cambias uno, cambia ambos.
- **Idioma**: UI, comentarios y README en español. Mantener consistencia.
- Balance del juego: constantes juntas arriba de cada clase (`RADII`, `SPEEDS`, `POINTS`, `ROT`, `THRUST`, etc.). Tuning de dificultad ocurre ahí, no disperso.
- Input usa `e.code` con `preventDefault` en flechas/espacio para evitar scroll de la página.

## Trampas

- **El README miente**: promete power-ups y asteroides "estrella fugaz" que NO existen en `game.js`. El código es la fuente de verdad; no implementes features del README sin confirmar con el usuario, y no "corrijas" el código para que coincida con el README.
- Todo el estado del juego es global (`state`, `ship`, `asteroids`, ...) con máquina de estados `'playing' | 'dead' | 'gameover'`. Las colisiones marcan `.dead` y se filtran después — mantener ese patrón, no mutar arrays durante iteración.
- `dt` se limita a 0.05 s en el loop; asumir dt real quebra el toro (wrap de bordes) en pestañas inactivas.
