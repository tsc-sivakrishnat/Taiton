import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/utils/**', 'src/constants/**', 'src/hooks/usePermissions.js', 'src/components/AccessDenied.jsx', 'src/components/FieldError.jsx', 'src/routes/PermissionRoute.jsx'],
    },
  },
});
