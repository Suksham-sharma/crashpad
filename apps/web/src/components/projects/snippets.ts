export const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm', 'bun'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export function installCommand(pm: PackageManager): string {
  switch (pm) {
    case 'npm':
      return 'npm install @crashpad/sdk';
    case 'yarn':
      return 'yarn add @crashpad/sdk';
    case 'pnpm':
      return 'pnpm add @crashpad/sdk';
    case 'bun':
      return 'bun add @crashpad/sdk';
  }
}

export const FRAMEWORKS = ['next-app', 'next-pages', 'vite'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  'next-app': 'Next.js (App Router)',
  'next-pages': 'Next.js (Pages Router)',
  vite: 'Vite / CRA',
};

export const FRAMEWORK_FILES: Record<Framework, string> = {
  'next-app': 'app/crashpad-init.tsx',
  'next-pages': 'pages/_app.tsx',
  vite: 'src/main.tsx',
};

export function frameworkSnippet(fw: Framework, apiKey: string): string {
  switch (fw) {
    case 'next-app':
      return `'use client';

import { useEffect } from 'react';
import { Crashpad } from '@crashpad/sdk';

// Render <CrashpadInit /> once inside app/layout.tsx's <body>.
export function CrashpadInit() {
  useEffect(() => {
    Crashpad.init({
      apiKey: '${apiKey}',
      environment: 'production',
    });
  }, []);
  return null;
}`;
    case 'next-pages':
      return `import { useEffect } from 'react';
import { Crashpad } from '@crashpad/sdk';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    Crashpad.init({
      apiKey: '${apiKey}',
      environment: 'production',
    });
  }, []);
  return <Component {...pageProps} />;
}`;
    case 'vite':
      return `import React from 'react';
import ReactDOM from 'react-dom/client';
import { Crashpad } from '@crashpad/sdk';
import App from './App';

Crashpad.init({
  apiKey: '${apiKey}',
  environment: 'production',
});

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);`;
  }
}

export function initSnippet(apiKey: string): string {
  return `import { Crashpad } from '@crashpad/sdk';

Crashpad.init({
  apiKey: '${apiKey}',
  environment: 'production',
});`;
}
