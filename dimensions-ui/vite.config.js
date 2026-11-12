import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import registryFiles from './registry-files.js'

export default defineConfig({ plugins: [react(), registryFiles()] })
