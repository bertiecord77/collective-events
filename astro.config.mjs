import { defineConfig } from 'astro/config';

export default defineConfig({
  // Output static HTML
  output: 'static',

  // Build to 'dist' folder
  outDir: './dist',

  // Keep public folder structure (assets copied to /assets/*)
  publicDir: './public',

  // Site URL for canonical links
  site: 'https://collective-events.netlify.app',

  // Use clean URLs without trailing slashes
  trailingSlash: 'never'
});
