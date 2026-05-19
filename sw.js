const CACHE_NAME = 'buvette-cache-v2';

// Fichiers critiques à mettre en cache immédiatement
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/framework7-bundle.min.css',
  './js/framework7-bundle.min.js',
  './js/app.js',
  './manifest.json',
  './icon-100.png',
  './icon-50.png'
  // N'oublie pas d'ajouter './icon-192.png' et './icon-512.png' quand tu les auras créés
];

// Installation : on force la mise en cache de la structure
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Mise en cache des ressources PWA');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activation : on nettoie les anciens caches si la version change
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Nettoyage de l\'ancien cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si le fichier est en cache, on le renvoie
      if (cachedResponse) {
        return cachedResponse;
      }

      // Sinon, on le cherche sur le réseau, mais on attrape l'erreur si ça échoue (404 ou déconnexion)
      return fetch(event.request).catch((err) => {
        console.warn('Fichier introuvable ou réseau coupé pour :', event.request.url);
        // On renvoie une réponse vide ou une erreur propre au lieu de faire crasher le SW
        return new Response('Ressource indisponible', { status: 404, statusText: 'Not Found' });
      });
    })
  );
});