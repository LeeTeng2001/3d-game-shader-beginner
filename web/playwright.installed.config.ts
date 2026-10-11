import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Optional checks against locally installed stable browsers. The default suite
// remains portable and needs only Playwright's Chromium and Firefox downloads.
export default defineConfig({
  ...base,
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
  ],
});
