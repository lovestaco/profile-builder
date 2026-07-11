import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

const root = import.meta.dirname

function copyExtensionStatics() {
  return {
    name: 'copy-extension-statics',
    closeBundle() {
      const dist = resolve(root, 'dist')
      mkdirSync(dist, { recursive: true })

      copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'))

      mkdirSync(resolve(dist, 'icons'), { recursive: true })
      for (const f of readdirSync(resolve(root, 'icons'))) {
        copyFileSync(resolve(root, 'icons', f), resolve(dist, 'icons', f))
      }

      const contentSrc = resolve(root, 'src', 'content')
      if (existsSync(contentSrc)) {
        mkdirSync(resolve(dist, 'content'), { recursive: true })
        for (const f of readdirSync(contentSrc)) {
          copyFileSync(resolve(contentSrc, f), resolve(dist, 'content', f))
        }
      }

      const configSrc = resolve(root, 'src', 'config')
      if (existsSync(configSrc)) {
        mkdirSync(resolve(dist, 'config'), { recursive: true })
        for (const f of readdirSync(configSrc)) {
          copyFileSync(resolve(configSrc, f), resolve(dist, 'config', f))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyExtensionStatics()],
  root: resolve(root, 'src', 'popup'),
  build: {
    rollupOptions: {
      input: { popup: resolve(root, 'src', 'popup', 'popup.html') },
    },
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
  },
})
