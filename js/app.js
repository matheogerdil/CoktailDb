// Initialisation de Framework7
const app = new Framework7({
  el: '#app',
  name: 'Buvette',
  theme: 'auto', 
});

const $ = app.$;

// Base de données locale des produits
let products = [
  { id: 1, name: 'Bière blonde Pression', price: 3.00, qty: 0 },
  { id: 2, name: 'Soda / Cola', price: 2.00, qty: 0 },
  { id: 3, name: 'Eau Minérale', price: 2.00, qty: 0 },
  { id: 4, name: 'Hot Dog ', price: 4.00, qty: 0 },
  { id: 5, name: 'Frites', price: 2.50, qty: 0 },
  { id: 6, name: 'frites saucisse', price: 3.50, qty: 0 },
  { id: 7, name: 'biere verte', price: 2.50, qty: 0 },
  { id: 8, name: 'pichet blonde', price: 12, qty: 0 },
  { id: 9, name: 'pichet verte', price: 18, qty: 0 },
  { id: 10, name: 'vin bouteille', price: 12, qty: 0 },
  { id: 11, name: 'cerdon', price: 17, qty: 0 },
];

// Moteur de rendu de la liste
function renderProducts() {
  let html = '';
  
  products.forEach((p, index) => {
    // On met en surbrillance si la quantité est > 0
    const bgColor = p.qty > 0 ? 'bg-color-lightgray' : '';
    
    html += `
      <li class="${bgColor}" style="transition: background 0.2s;">
        <div class="item-content">
          <div class="item-inner">
            <div class="item-title-row">
              <div class="item-title" style="font-size: 18px;">${p.name}</div>
              <div class="item-after" style="font-weight: bold; font-size: 18px;">${p.price.toFixed(2)} CHF</div>
            </div>
            <div class="item-subtitle" style="margin-top: 10px;">
              <div class="display-flex align-items-center">
                <button class="button button-fill button-round color-red qty-btn btn-minus" data-index="${index}">-</button>
                <div class="qty-display margin-horizontal">${p.qty}</div>
                <button class="button button-fill button-round color-blue qty-btn btn-plus" data-index="${index}">+</button>
              </div>
            </div>
          </div>
        </div>
      </li>
    `;
  });

  $('#product-list').html(html);
  updateTotal();
}

// Calcul du total
function updateTotal() {
  const total = products.reduce((sum, p) => sum + (p.price * p.qty), 0);
  $('#total-price').text(total.toFixed(2));
}

// === GESTION DES ÉVÉNEMENTS ===

// Incrémenter
$(document).on('click', '.btn-plus', function() {
  const index = $(this).data('index');
  products[index].qty++;
  renderProducts();
});

// Décrémenter
$(document).on('click', '.btn-minus', function() {
  const index = $(this).data('index');
  if (products[index].qty > 0) {
    products[index].qty--;
    renderProducts();
  }
});

// Vider la caisse en cours
$('#btn-reset').on('click', function() {
  const total = products.reduce((sum, p) => sum + p.qty, 0);
  if (total === 0) return; // Rien à vider
  
  app.dialog.confirm('Vider la commande en cours ?', 'Attention', function () {
    products.forEach(p => p.qty = 0);
    renderProducts();
  });
});

// Validation de l'encaissement
$('#btn-encaisser').on('click', function() {
  const total = products.reduce((sum, p) => sum + (p.price * p.qty), 0);
  
  if (total === 0) {
    app.toast.create({
      text: 'Ajoutez des articles avant d\'encaisser',
      position: 'center',
      closeTimeout: 2000,
    }).open();
    return;
  }

  app.dialog.alert(`Montant encaissé : <b>${total.toFixed(2)} CHF</b>`, 'Merci !', function() {
    products.forEach(p => p.qty = 0);
    renderProducts();
  });
});

// Initialisation de l'affichage
renderProducts();

// === PWA : ENREGISTREMENT DU SERVICE WORKER ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('SW enregistré (Scope:', registration.scope, ')');
      })
      .catch((error) => {
        console.error('Échec SW:', error);
      });
  });
}
