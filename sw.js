const CACHE_NAME = 'buvette-cache-v2';

// Fichiers critiques à mettre en cache immédiatement
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/framework7-bundle.min.css',
  './js/framework7-bundle.min.js',
  './js/app.js',
  './manifest.json'
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

// Interception des requêtes réseau : Stratégie "Cache First"
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Retourne le fichier en cache s'il existe, sinon lance la requête réseau
      return cachedResponse || fetch(event.request);
    })
  );
});