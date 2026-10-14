import { fileURLToPath } from 'node:url';

// Reuse the installed web test dependencies, with one React instance. No install required.
const webPackage = name => fileURLToPath(new URL(`../web/node_modules/${name}`, import.meta.url));
export default {
  envDir: false,
  esbuild: { jsx: 'automatic' },
  resolve: { alias: ['react', 'react-dom', 'axios', 'leaflet', 'react-leaflet',
    '@testing-library/react', '@testing-library/jest-dom'].map(name => ({ find: name, replacement: webPackage(name) })) },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.cjs', './tests/ui-setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
  },
};
