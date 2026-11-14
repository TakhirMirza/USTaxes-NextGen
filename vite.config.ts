import { readdirSync } from 'node:fs'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Content Security Policy for the published app: it may load only its own files and may not send
 * data to any other site. 'unsafe-inline' for styles covers React style attributes only; scripts
 * must come from the site itself.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ')

const hash = (text: string): string => {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}

/** Service worker that keeps the whole app and the blank IRS forms on the device for offline use. */
const serviceWorker = (version: string, files: string[]): string => `/* USTaxes NextGen offline cache — generated at build time */
const CACHE = 'ustaxes-${version}'
const PRECACHE = ${JSON.stringify(files)}
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ustaxes-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    // The page itself: newest version when online, the saved copy when offline.
    event.respondWith(fetch(request)
      .then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put('index.html', copy)); return response })
      .catch(() => caches.match('index.html').then((hit) => hit || caches.match('./'))))
    return
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)) }
    return response
  })))
})
`

function privacyHardening(): Plugin {
  return {
    name: 'ustaxes-privacy-hardening',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
    },
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html' && f !== 'sw.js')
      const forms = readdirSync('public/forms/2025').filter((f) => f.endsWith('.pdf')).map((f) => `forms/2025/${f}`)
      const files = ['./', 'index.html', ...built, 'favicon.ico', 'manifest.json', 'logo192.png', 'logo512.png', ...forms]
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker(hash(files.join('|') + Date.now()), files) })
    }
  }
}

export default defineConfig({ plugins: [react(), privacyHardening()], base: '/USTaxes-NextGen/' })
