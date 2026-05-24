import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'firebase-config-fallback',
        resolveId(source) {
          if (source.includes('firebase-applet-config.json')) {
            const targetPath = path.resolve(__dirname, 'src/firebase-applet-config.json');
            if (!fs.existsSync(targetPath)) {
              return 'virtual:firebase-applet-config';
            }
          }
          return null;
        },
        load(id) {
          if (id === 'virtual:firebase-applet-config') {
            return `export default {
              apiKey: "",
              authDomain: "",
              projectId: "",
              storageBucket: "",
              messagingSenderId: "",
              appId: "",
              measurementId: "",
              firestoreDatabaseId: ""
            };`;
          }
          return null;
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
