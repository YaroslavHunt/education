import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, relative, sep } from 'node:path'

// GitHub repo name -> the site is served from https://<user>.github.io/<REPO>/
// Change this one line if you ever rename the repository.
const REPO = 'education'

// Repo root = the parent of this `config/` folder.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * Shared Vite config for every lesson app.
 *
 * Each lesson's own `vite.config.js` is a single line:
 *
 *     import { lesson } from '<relative>/config/vite.lesson.js'
 *     export default lesson(import.meta.url)
 *
 * The production `base` is derived automatically from where the folder lives,
 * so you never hand-edit base paths when adding a lesson:
 *
 *     home/              -> /education/
 *     nodejs/event-loop/ -> /education/nodejs/event-loop/
 *     nest/lifecycle/    -> /education/nest/lifecycle/
 *
 * In local dev the base is "/" so each app opens cleanly at http://localhost:5173/.
 */
export function lesson(metaUrl) {
  const dir = dirname(fileURLToPath(metaUrl))
  const rel = relative(ROOT, dir).split(sep).join('/')
  const isHome = rel === '' || rel === 'home'
  const prodBase = isHome ? `/${REPO}/` : `/${REPO}/${rel}/`

  return defineConfig(({ command }) => ({
    plugins: [react()],
    base: command === 'build' ? prodBase : '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  }))
}
