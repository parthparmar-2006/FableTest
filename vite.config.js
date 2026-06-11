import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths: required for itch.io/CrazyGames, which serve the
  // game from a nested directory rather than the site root
  base: './',
});
