import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { Children, isValidElement, type PropsWithChildren, type ReactNode } from 'react';
import { colors, cssVariables, typography } from '@tawreed/design-tokens';

const globalStyles = `${cssVariables}
@font-face{font-family:"NotoKufiArabic";src:url('/fonts/kufi.woff2') format('woff2');font-display:swap;font-weight:100 900}
@font-face{font-family:"Manrope";src:url('/fonts/manrope.woff2') format('woff2');font-display:swap;font-weight:200 800}
html{background:var(--color-bg-subtle);color:var(--color-text)}
body{background:var(--color-bg-subtle);font-family:${typography.family.web};margin:0}
*{box-sizing:border-box}button,input,textarea{font:inherit}
*:focus-visible{outline:3px solid var(--color-focus-ring);outline-offset:2px}
[data-viewport]{display:contents!important}
@media (max-width:680px),(max-width:900px) and (max-height:500px){[data-viewport=tablet],[data-viewport=desktop]{display:none!important}}
@media (min-width:681px) and (max-width:900px) and (min-height:501px){[data-viewport=phone],[data-viewport=desktop]{display:none!important}}
@media (min-width:901px){[data-viewport=phone],[data-viewport=tablet]{display:none!important}}
#tawreed-splash{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#FFFFFF;animation:tawreed-splash-out .35s ease 2.4s forwards}
#tawreed-splash svg{width:clamp(96px,28vmin,160px);height:auto;animation:tawreed-splash-in .45s ease-out both}
.tawreed-splash-seen #tawreed-splash{display:none}
.tawreed-splash-done #tawreed-splash{animation:tawreed-splash-out .3s ease forwards}
@keyframes tawreed-splash-in{from{opacity:0;transform:scale(.92)}}
@keyframes tawreed-splash-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important}}
`;

// Brand splash for the first page load of a browser session. It continues the installed app's own splash (the same
// logo on the same white), then fades to the pre-rendered header, bottom bar and skeletons. It leaves once the page has
// hydrated (after at least 0.9s) and by CSS alone after 2.4s, so a slow network never keeps the page hidden.
const splashScript = `(function(d){var start=Date.now();try{if(sessionStorage.getItem('tawreed-splash'))d.classList.add('tawreed-splash-seen');else sessionStorage.setItem('tawreed-splash','1');}catch(e){}window.__tawreedSplashDone=function(){setTimeout(function(){d.classList.add('tawreed-splash-done');},Math.max(0,900-(Date.now()-start)));};})(document.documentElement);`;
// Vercel Web Analytics. +html is only rendered at build time and never runs in the browser, so the
// `<Analytics />` React component cannot load from here; Vercel's plain-HTML snippet can. The script is
// served by Vercel deployments only and tracks client-side route changes on its own.
const analyticsQueue = 'window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};';
const splashLogo ='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="توريد"><path fill="#0E5245" d="M24,94V136A76,76 0 0 0 100,212H156A76,76 0 0 0 232,136V94A19.0,19.0 0 0 0 194,94V136A38,38 0 0 1 156,174H100A38,38 0 0 1 62,136V94A19.0,19.0 0 0 0 24,94Z"/><path fill="#F4A62A" d="M112.97,54.97L96.95,64.22A24.0,24.0 0 0 0 120.95,105.78L136.97,96.53Z"/><path fill="#F4A62A" d="M119.03,51.47L135.05,42.22A24.0,24.0 0 0 1 159.05,83.78L143.03,93.03Z"/></svg>';

// With cached or fast-arriving bundles the browser runs every deferred script straight after parsing, before its
// first paint, so the pre-rendered page would stay blank until ~3MB of JS has run. Start the bundles (in order; the
// head preloads them) only after a frame has been painted. Hidden tabs never paint, so they load at once.
function deferUntilPainted(nodes: ReactNode) {
  const sources: string[] = [];
  const others = Children.toArray(nodes).filter((node) => {
    if (isValidElement<{ src?: string }>(node) && node.type === 'script' && node.props.src) { sources.push(node.props.src); return false; }
    return true;
  });
  const loader = `(function(s){function go(){s.forEach(function(src){var e=document.createElement('script');e.src=src;e.async=false;document.body.appendChild(e);});}if(document.visibilityState==='hidden')go();else requestAnimationFrame(function(){setTimeout(go,0);});})(${JSON.stringify(sources)});`;
  return <>{others}{sources.length ? <script dangerouslySetInnerHTML={{ __html: loader }} /> : null}</>;
}

// Static rendering (app.json web.output "static") passes the JS bundles, React Native Web styles and fonts
// through headNodes/bodyNodes; without them the pre-rendered pages never hydrate.
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html {...htmlAttributes} lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>توريد | مستلزماتك الطبية</title>
        <meta name="description" content="مستلزماتك الطبية، واصلة لعندك. للأطباء والطلاب والعيادات، بسرعة وبسعر ممتاز." />
        {/* Matches the white header (and the splash), so the browser bar and status bar never show a different-coloured edge. */}
        <meta name="theme-color" content={colors.surface} />
        <meta name="apple-mobile-web-app-title" content="توريد" />
        <meta name="application-name" content="توريد" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta property="og:title" content="توريد | Tawreed" />
        <meta property="og:description" content="احتياجك، واصل لعندك." />
        <meta property="og:image" content="/og-tawreed.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Arabic/Latin subsets of assets/fonts (fontTools pyftsubset, woff2); Arabic text dominates, so only Kufi is preloaded. */}
        <link rel="preload" href="/fonts/kufi.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <script dangerouslySetInnerHTML={{ __html: splashScript }} />
        <script dangerouslySetInnerHTML={{ __html: analyticsQueue }} />
        <script defer src="/_vercel/insights/script.js" />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        <div id="tawreed-splash" dangerouslySetInnerHTML={{ __html: splashLogo }} />
        {deferUntilPainted(bodyNodes)}
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){var local=location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname==='[::1]';if(local){navigator.serviceWorker.getRegistrations().then(function(registrations){registrations.forEach(function(registration){registration.unregister();});}).catch(function(){});return;}navigator.serviceWorker.register('/service-worker.js').catch(function(){});});}` }} />
      </body>
    </html>
  );
}
