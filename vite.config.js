import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: '/org-graph-3d/',
  plugins: [react(), viteSingleFile()],
  test: {
    environment: 'node',
  },
});
