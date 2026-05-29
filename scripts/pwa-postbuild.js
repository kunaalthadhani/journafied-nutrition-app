#!/usr/bin/env node
/**
 * Run after `npx expo export --platform web`. Patches dist/ with PWA bits
 * that Expo doesn't emit automatically: viewport scroll fixes, iOS PWA meta
 * tags, icon font @font-face declarations, manifest.json, vercel.json, and
 * the icon files.
 *
 * Usage:  node scripts/pwa-postbuild.js
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const ASSETS_FONTS = path.join(DIST, 'assets', 'node_modules', 'expo', 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'Fonts');

if (!fs.existsSync(DIST)) {
    console.error('dist/ not found. Run `npx expo export --platform web` first.');
    process.exit(1);
}

// Discover hashed icon font filenames so we hardcode the right URLs.
const fontDir = fs.existsSync(ASSETS_FONTS) ? fs.readdirSync(ASSETS_FONTS) : [];
const findFont = (name) => fontDir.find((f) => f.startsWith(name + '.') && f.endsWith('.ttf'));
const featherTtf = findFont('Feather');
const ioniconsTtf = findFont('Ionicons');
const materialTtf = findFont('MaterialIcons');

const fontUrl = (file) => `/assets/node_modules/expo/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/${file}`;

// Build the patched style block + meta tags.
const fontFaces = [
    featherTtf && `@font-face { font-family: 'Feather'; src: url('${fontUrl(featherTtf)}') format('truetype'); font-display: block; }`,
    ioniconsTtf && `@font-face { font-family: 'Ionicons'; src: url('${fontUrl(ioniconsTtf)}') format('truetype'); font-display: block; }`,
    materialTtf && `@font-face { font-family: 'MaterialIcons'; src: url('${fontUrl(materialTtf)}') format('truetype'); font-display: block; }`,
].filter(Boolean).join('\n      ');

const cssBlock = `<style id="expo-reset">
      html, body, #root { height: 100%; max-width: 100vw; overflow-x: hidden; }
      body { overflow: hidden; margin: 0; padding: 0; }
      #root { display: flex; flex: 1; width: 100%; }
      @supports (padding: env(safe-area-inset-top)) {
        body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); background: #FBF9F4; }
      }
      ${fontFaces}
    </style>${featherTtf ? `\n    <link rel="preload" as="font" type="font/ttf" href="${fontUrl(featherTtf)}" crossorigin>` : ''}`;

const metaBlock = `<meta name="theme-color" content="#FBF9F4">
<meta name="description" content="The AI calorie tracker that knows shawarma.">
<link rel="icon" href="/favicon.ico" />
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="TrackKcal">
<meta name="mobile-web-app-capable" content="yes">`;

// Patch index.html.
const indexPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Replace the entire expo-reset block.
html = html.replace(/<style id="expo-reset">[\s\S]*?<\/style>/, cssBlock);

// Replace the meta/link block that Expo emitted after expo-reset.
html = html.replace(
    /<meta name="theme-color"[^>]*>\s*<meta name="description"[^>]*>\s*<link rel="icon"[^>]*>/,
    metaBlock,
);

fs.writeFileSync(indexPath, html);
console.log('✓ Patched dist/index.html');

// manifest.json
fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify({
    name: 'TrackKcal',
    short_name: 'TrackKcal',
    description: 'The AI calorie tracker that knows shawarma.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#FBF9F4',
    background_color: '#FBF9F4',
    orientation: 'portrait',
    lang: 'en',
    scope: '/',
    icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
}, null, 2));
console.log('✓ Wrote dist/manifest.json');

// vercel.json
fs.writeFileSync(path.join(DIST, 'vercel.json'), JSON.stringify({
    name: 'trackkcal-pwa',
    cleanUrls: true,
    trailingSlash: false,
    headers: [
        {
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            ],
        },
    ],
    rewrites: [
        { source: '/((?!api|_expo|assets|.*\\..*).*)', destination: '/index.html' },
    ],
}, null, 2));
console.log('✓ Wrote dist/vercel.json');

// .vercelignore — override Vercel's default node_modules exclusion so the
// bundled @expo/vector-icons font files (at assets/node_modules/.../Fonts/)
// actually reach the CDN. Without this they 404 and icons render as squares.
fs.writeFileSync(path.join(DIST, '.vercelignore'),
    `!assets/node_modules\n!assets/node_modules/**\n`);
console.log('✓ Wrote dist/.vercelignore');

// Copy icon for PWA manifest + Apple touch.
const sourceIcon = path.join(__dirname, '..', 'assets', 'icon.png');
if (fs.existsSync(sourceIcon)) {
    for (const out of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
        fs.copyFileSync(sourceIcon, path.join(DIST, out));
    }
    console.log('✓ Copied PWA icons');
} else {
    console.warn('! assets/icon.png missing, skipping PWA icon copies');
}

console.log('\nDone. Now run:');
console.log('  cd dist');
console.log('  npx vercel deploy --prod --yes --scope kunalt96-hotmailcoms-projects');
