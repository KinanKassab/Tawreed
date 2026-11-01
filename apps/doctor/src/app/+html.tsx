import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { colors, cssVariables, typography } from '@tawreed/design-tokens';

const globalStyles = `${cssVariables}
@font-face{font-family:"NotoKufiArabic";src:url('/fonts/kufi.woff2') format('woff2');font-display:swap;font-weight:400 800}
@font-face{font-family:"Manrope";src:url('/fonts/manrope.woff2') format('woff2');font-display:swap;font-weight:400 800}
html{background:var(--color-bg-subtle);color:var(--color-text)}
body{background:var(--color-bg-subtle);font-family:${typography.family.web};margin:0}
*{box-sizing:border-box}button,input,textarea{font:inherit}
*:focus-visible{outline:3px solid var(--color-focus-ring);outline-offset:2px}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>توريد | مستلزماتك الطبية</title>
        <meta name="description" content="مستلزماتك الطبية، واصلة لعندك. منصة تربط الأطباء والطلاب والعيادات بموردين موثوقين." />
        <meta name="theme-color" content={colors.primary} />
        <meta name="apple-mobile-web-app-title" content="توريد" />
        <meta name="application-name" content="توريد" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta property="og:title" content="توريد | Tawreed" />
        <meta property="og:description" content="احتياجك، واصل لعندك." />
        <meta property="og:image" content="/og-tawreed.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preload" href="/fonts/kufi.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/manrope.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>undefined));}` }} />
      </body>
    </html>
  );
}
