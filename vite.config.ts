import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
      '@database': path.resolve(__dirname, './database'),
      '@core': path.resolve(__dirname, './core'),
      '@ai': path.resolve(__dirname, './ai'),
      '@rag': path.resolve(__dirname, './rag'),
      '@sync': path.resolve(__dirname, './sync'),
      '@documents': path.resolve(__dirname, './documents'),
      '@models': path.resolve(__dirname, './models')
    }
  }
});
