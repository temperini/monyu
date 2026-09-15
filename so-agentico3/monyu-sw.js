const CACHE_NAME='monyu-v30-20260915-9';
const CORE=[
  './2026-08-09_monyu-so-agentico_app_v30.html?mode=mvp',
  './2026-08-09_monyu-so-agentico_app_v30.css?v=9',
  './2026-08-09_monyu-so-agentico_app_v30.js?v=9',
  './2026-08-09_monyu-so-agentico_tokens_v30.css?v=9',
  './2026-08-09_monyu-so-agentico_favicon_v30.svg'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{var copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match(CORE[0]))));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{var copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response})));
});
