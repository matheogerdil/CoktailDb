// Common functions for CocktailDB Explorer

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

// Global handler to catch unhandled promise rejections (helps surface origin)
window.addEventListener('unhandledrejection', (event) => {
    // Log full info for debugging
    console.warn('Unhandled promise rejection caught:', event.reason);
    // Prevent the default console error if it's caused by external extensions
    try {
        event.preventDefault();
    } catch (e) {
        // ignore
    }
});

async function apiCall(endpoint) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        const data = await response.json();
        return data.drinks || [];
    } catch (error) {
        console.error('API Error:', error);
        return [];
    }
}

async function fetchRandomCocktail() {
    return (await apiCall('/random.php'))[0];
}

async function searchCocktailsByName(name) {
    return await apiCall(`/search.php?s=${encodeURIComponent(name)}`);
}

async function searchCocktailsByLetter(letter) {
    return await apiCall(`/search.php?f=${letter}`);
}

async function searchIngredientByName(name) {
    return await apiCall(`/search.php?i=${encodeURIComponent(name)}`);
}

async function lookupCocktailById(id) {
    return (await apiCall(`/lookup.php?i=${id}`))[0];
}

async function lookupIngredientById(id) {
    return (await apiCall(`/lookup.php?iid=${id}`))[0];
}

async function filterByIngredient(ingredient) {
    return await apiCall(`/filter.php?i=${encodeURIComponent(ingredient)}`);
}

async function filterByAlcoholic(type) {
    return await apiCall(`/filter.php?a=${type}`);
}

async function filterByCategory(category) {
    return await apiCall(`/filter.php?c=${encodeURIComponent(category)}`);
}

async function filterByGlass(glass) {
    return await apiCall(`/filter.php?g=${encodeURIComponent(glass)}`);
}

async function listCategories() {
    return await apiCall('/list.php?c=list');
}

async function listGlasses() {
    return await apiCall('/list.php?g=list');
}

async function listIngredients() {
    return await apiCall('/list.php?i=list');
}

// --- Cocktail selector + ingredient editor helpers ---
function parseMeasure(measure) {
    if (!measure) return { amount: 1, unit: '' };
    const s = measure.trim();
    // Replace vulgar fractions like 1/2, 1 1/2
    // Try to extract a number at start
    const match = s.match(/^([\d\s.\/\-\u00BC\u00BD\u00BE]+)\s*(.*)$/);
    if (match) {
        let numStr = match[1].trim();
        // handle common formats
        numStr = numStr.replace(/\u00BC/g, '1/4').replace(/\u00BD/g, '1/2').replace(/\u00BE/g, '3/4');
        // if contains fraction like "1 1/2"
        if (numStr.match(/\d+\s+\d+\/\d+/)) {
            const parts = numStr.split(' ');
            const whole = parseInt(parts[0],10);
            const fracParts = parts[1].split('/');
            const fracVal = parseInt(fracParts[0],10)/parseInt(fracParts[1],10);
            return { amount: whole + fracVal, unit: match[2].trim() };
        }
        if (numStr.includes('/')) {
            const f = numStr.match(/^(\d+)\/(\d+)$/);
            if (f) return { amount: parseInt(f[1],10)/parseInt(f[2],10), unit: match[2].trim() };
        }
        const n = parseFloat(numStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(n)) return { amount: n, unit: match[2].trim() };
    }
    // fallback: return measure as unit (no numeric amount)
    return { amount: 1, unit: s };
}

async function loadCocktailSelector() {
    const sel = document.getElementById('cocktailSelect');
    if (!sel) return;
    // Use category 'Cocktail' to get a reasonable list (free endpoint)
    const list = await filterByCategory('Cocktail');
    // sort by name
    list.sort((a,b) => (a.strDrink || '').localeCompare(b.strDrink || ''));
    list.slice(0, 80).forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.idDrink;
        opt.textContent = d.strDrink;
        sel.appendChild(opt);
    });

    sel.addEventListener('change', async () => {
        const id = sel.value;
        if (!id) {
            document.getElementById('selectedCocktailInfo').classList.add('hidden');
            return;
        }
        await loadSelectedCocktail(id);
    });
}

// state for current cocktail editor
let editorState = { baseServings: 1, baseIngredients: [] };

async function loadSelectedCocktail(id) {
    const data = await lookupCocktailById(id);
    if (!data) return;
    const title = document.getElementById('cocktailTitle');
    const info = document.getElementById('selectedCocktailInfo');
    const editor = document.getElementById('ingredientsEditor');
    const servingsInput = document.getElementById('servingsInput');

    title.textContent = data.strDrink;
    info.classList.remove('hidden');

    // build ingredients list
    const ingredients = [];
    for (let i=1;i<=15;i++) {
        const name = data[`strIngredient${i}`];
        const measure = data[`strMeasure${i}`];
        if (name) {
            const parsed = parseMeasure(measure || '');
            ingredients.push({ name: name.trim(), measure: measure || '', baseAmount: parsed.amount || 1, unit: parsed.unit || '' });
        }
    }

    editorState.baseServings = 1;
    editorState.baseIngredients = ingredients.map(i => ({ ...i }));

    // render editor rows
    editor.innerHTML = '';
    ingredients.forEach((ing, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-4';
        row.innerHTML = `
            <div class="w-1/2 text-slate-100">${ing.name}</div>
            <div class="flex items-center gap-2">
                <input data-idx="${idx}" class="ingredient-amount w-24 bg-background-dark/60 text-slate-100 rounded px-2 py-1" type="number" step="0.01" min="0" value="${ing.baseAmount}">
                <span class="text-slate-400">${ing.unit}</span>
            </div>
        `;
        editor.appendChild(row);
    });

    // servings input handler
    servingsInput.value = 1;
    servingsInput.oninput = () => {
        const newServings = parseFloat(servingsInput.value) || 0;
        if (newServings <= 0) return;
        const ratio = newServings / editorState.baseServings;
        const inputs = editor.querySelectorAll('input.ingredient-amount');
        inputs.forEach(inp => {
            const idx = parseInt(inp.dataset.idx,10);
            const base = editorState.baseIngredients[idx].baseAmount;
            inp.value = Math.round((base * ratio + Number.EPSILON) * 100) / 100;
        });
    };

    // ingredient amount change handler (two-way)
    editor.querySelectorAll('input.ingredient-amount').forEach(inp => {
        inp.addEventListener('input', () => {
            const idx = parseInt(inp.dataset.idx,10);
            const newAmount = parseFloat(inp.value) || 0;
            const base = editorState.baseIngredients[idx].baseAmount;
            // compute new servings as ratio
            const newServings = base === 0 ? editorState.baseServings : (newAmount / base) * editorState.baseServings;
            if (newServings <= 0) return;
            // update servings input (will update other inputs via oninput)
            servingsInput.value = Math.round((newServings + Number.EPSILON) * 100) / 100;
            // apply ratio to all inputs except the one just changed
            const ratio = newServings / editorState.baseServings;
            editor.querySelectorAll('input.ingredient-amount').forEach(other => {
                const oidx = parseInt(other.dataset.idx,10);
                if (oidx === idx) return; // keep user's value
                const obase = editorState.baseIngredients[oidx].baseAmount;
                other.value = Math.round((obase * ratio + Number.EPSILON) * 100) / 100;
            });
        });
    });
}

async function listAlcoholicFilters() {
    return await apiCall('/list.php?a=list');
}

function getCocktailImage(drink, size = 'medium') {
    return drink.strDrinkThumb || 'https://via.placeholder.com/350';
}

function getIngredientImage(ingredient, size = 'medium') {
    const sizes = { small: '-Small.png', medium: '-Medium.png', large: '.png' };
    return `https://www.thecocktaildb.com/images/ingredients/${ingredient}${sizes[size]}`;
}

// Favorites management (hoisted function declarations)
function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem('cocktailFavorites') || '[]');
    } catch (e) {
        return [];
    }
}

function addFavorite(id) {
    const favs = getFavorites();
    if (!favs.includes(id)) {
        favs.push(id);
        localStorage.setItem('cocktailFavorites', JSON.stringify(favs));
    }
}

function removeFavorite(id) {
    const favs = getFavorites();
    const idx = favs.indexOf(id);
    if (idx > -1) {
        favs.splice(idx, 1);
        localStorage.setItem('cocktailFavorites', JSON.stringify(favs));
    }
}

function isFavorite(id) {
    return getFavorites().includes(id);
}

function toggleFavorite(id, button) {
    if (isFavorite(id)) {
        removeFavorite(id);
        if (button) {
            button.classList.remove('text-primary');
            button.classList.add('text-white');
        }
    } else {
        addFavorite(id);
        if (button) {
            button.classList.remove('text-white');
            button.classList.add('text-primary');
        }
    }
}

function displayCocktailCard(drink, container) {
    const card = document.createElement('div');
    card.className = 'group bg-slate-200/5 dark:bg-white/5 border border-primary/10 rounded-xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer';
    card.onclick = () => window.location.href = `details.html?id=${drink.idDrink}`;
    card.innerHTML = `
        <div class="relative h-64 overflow-hidden">
            <img class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" src="${getCocktailImage(drink)}" alt="${drink.strDrink}" loading="lazy" onerror="this.src='https://via.placeholder.com/350'">
            <div class="absolute inset-0 bg-gradient-to-t from-background-dark/40 to-transparent"></div>
            <span class="absolute top-4 right-4 bg-primary/20 backdrop-blur-md text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/30">${drink.strCategory || 'Cocktail'}</span>
            <button class="absolute bottom-4 right-4 ${isFavorite(drink.idDrink) ? 'text-primary' : 'text-white'} hover:text-primary transition-colors material-symbols-outlined favorite-btn">favorite</button>
        </div>
        <div class="p-6">
            <h3 class="text-xl font-bold text-slate-100 mb-1">${drink.strDrink}</h3>
            <p class="text-slate-400 text-sm mb-4">${drink.strInstructions ? drink.strInstructions.substring(0, 100) + '...' : 'No description available.'}</p>
            <div class="flex flex-wrap gap-2">
                ${getTags(drink).map(tag => `<span class="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">${tag}</span>`).join('')}
            </div>
        </div>
    `;
    container.appendChild(card);
    
    // Add favorite button functionality
    const favBtn = card.querySelector('.favorite-btn');
    favBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent card click
        toggleFavorite(drink.idDrink, favBtn);
    };
}

function getTags(drink) {
    const tags = [];
    if (drink.strAlcoholic) tags.push(drink.strAlcoholic);
    if (drink.strCategory) tags.push(drink.strCategory.split(' ')[0]);
    return tags.slice(0, 3);
}

async function loadFeaturedCocktails() {
    const container = document.getElementById('featuredGrid');
    if (!container) return;
    
    const seen = new Set();
    let attempts = 0;
    while (container.children.length < 6 && attempts < 15) {
        const drink = await fetchRandomCocktail();
        if (drink && !seen.has(drink.idDrink)) {
            seen.add(drink.idDrink);
            displayCocktailCard(drink, container);
        }
        attempts++;
    }
}

async function loadCocktailGrid(category = 'All') {
    const container = document.getElementById('cocktailGrid');
    if (!container) return;

    let drinks = [];
    if (category === 'All') {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const selectedLetters = [];
        while (selectedLetters.length < 9) {
            const randomLetter = letters[Math.floor(Math.random() * letters.length)];
            if (!selectedLetters.includes(randomLetter)) {
                selectedLetters.push(randomLetter);
            }
        }
        for (const letter of selectedLetters) {
            const letterDrinks = await searchCocktailsByLetter(letter);
            if (letterDrinks.length > 0) {
                drinks.push(letterDrinks[Math.floor(Math.random() * letterDrinks.length)]);
            }
        }
    } else {
        drinks = await filterByCategory(category);
    }

    displayCocktails(drinks);
}

async function fetchIngredients() {
    const ingredients = await listIngredients();
    displayIngredients(ingredients.slice(0, 42));
}

function displayIngredients(ingredients) {
    const container = document.getElementById('inventoryGrid');
    if (!container) return;
    container.innerHTML = ingredients.map(ing => `
        <div class="group relative flex flex-col gap-3 p-4 bg-primary/5 dark:bg-primary/[0.03] border border-primary/10 rounded-2xl hover:border-primary/50 transition-all cursor-pointer" onclick="showCocktailsByIngredient('${ing.strIngredient1}')">
            <div class="aspect-square rounded-xl overflow-hidden bg-background-dark/50 flex items-center justify-center">
                <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="${getIngredientImage(ing.strIngredient1)}" alt="${ing.strIngredient1}" onerror="this.src='https://via.placeholder.com/150'">
                <div class="absolute top-6 right-6 bg-primary text-background-dark rounded-full p-1 shadow-md">
                    <span class="material-symbols-outlined text-sm filled">check</span>
                </div>
            </div>
            <div>
                <h3 class="font-bold text-lg group-hover:text-primary transition-colors">${ing.strIngredient1}</h3>
                <p class="text-slate-500 text-xs font-medium uppercase tracking-tighter">Ingredient</p>
            </div>
            <div class="mt-2 text-primary flex items-center gap-1 text-sm font-bold">
                <span>Recipes available</span>
                <span class="material-symbols-outlined text-base">chevron_right</span>
            </div>
        </div>
    `).join('');
}

async function showCocktailsByIngredient(ingredient) {
    const drinks = await filterByIngredient(ingredient);
    const container = document.getElementById('cocktailContainer');
    const grid = document.getElementById('inventoryGrid');
    
    if (!container) return;

    // Hide inventory grid and show cocktail results
    if (grid) grid.style.display = 'none';
    container.style.display = 'block';

    const cocktailGrid = container.querySelector('.grid');
    cocktailGrid.innerHTML = '';
    drinks.slice(0, 12).forEach(drink => displayCocktailCard(drink, cocktailGrid));
}

async function loadCocktailsByGlass(glass) {
    const container = document.getElementById('cocktailGrid');
    if (!container) return;
    const drinks = await filterByGlass(glass);
    container.innerHTML = '';
    if (drinks.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center py-8">No cocktails found with the selected glass type.</p>';
    } else {
        drinks.slice(0, 9).forEach(drink => displayCocktailCard(drink, container));
    }
}

async function loadIngredientFilters() {
    const container = document.getElementById('ingredientFilters');
    if (!container) return;
    const ingredients = await listIngredients();
    container.innerHTML = ingredients.slice(0, 50).map(ing => `
        <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-primary transition-colors">
            <input value="${ing.strIngredient1}" class="ingredient-checkbox rounded border-primary/30 text-primary focus:ring-primary bg-transparent size-4" type="checkbox"/>
            <span class="ingredient-name">${ing.strIngredient1}</span>
        </label>
    `).join('');

    // Attach event listeners (only within this container)
    container.querySelectorAll('input.ingredient-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            const checkedBoxes = container.querySelectorAll('input.ingredient-checkbox:checked');
            if (checkedBoxes.length > 0) {
                const ingredients = Array.from(checkedBoxes).map(cb => cb.value.trim());
                await loadCocktailsByIngredients(ingredients);
            } else {
                loadCocktailGrid();
            }
        });
    });
}

async function loadCocktailDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) return;
    const drink = await lookupCocktailById(id);
    if (drink) displayCocktailDetail(drink);
}

function displayCocktailDetail(drink) {
    const container = document.getElementById('cocktailDetail');
    if (!container) return;

    let ingredients = '';
    for (let i = 1; i <= 15; i++) {
        const ingredient = drink[`strIngredient${i}`];
        const measure = drink[`strMeasure${i}`];
        if (ingredient) {
            ingredients += `
                <div class="flex justify-between items-center border-b border-primary/10 pb-3">
                    <span class="text-slate-300">${ingredient}</span>
                    <span class="font-bold text-primary">${measure || ''}</span>
                </div>
            `;
        }
    }

    let instructions = drink.strInstructions.split('. ').map(step => step.trim()).filter(step => step).map((step, index) => `
        <div class="flex gap-6 group">
            <div class="flex-none w-10 h-10 rounded-full bg-surface-dark border border-primary/30 text-primary flex items-center justify-center font-black transition-colors group-hover:bg-primary group-hover:text-background-dark">${index + 1}</div>
            <div class="pt-1">
                <p class="text-slate-400 leading-relaxed">${step}.</p>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <!-- Hero Section -->
        <div class="group relative mb-10 overflow-hidden rounded-xl bg-surface-dark min-h-[450px] flex flex-col justify-end p-8 border border-primary/10">
            <div class="absolute inset-0 z-0">
                <img class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" src="${getCocktailImage(drink, 'large')}" alt="${drink.strDrink}">
                <div class="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/40 to-transparent"></div>
            </div>
            <div class="relative z-10 space-y-4">
                <div class="flex flex-wrap gap-2">
                    <span class="rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-background-dark">${drink.strCategory || 'Cocktail'}</span>
                    <span class="rounded-full bg-surface-dark/80 backdrop-blur-md border border-primary/30 px-4 py-1 text-xs font-bold text-primary">${drink.strAlcoholic || 'Alcoholic'}</span>
                </div>
                <h1 class="text-5xl md:text-7xl font-black text-white tracking-tighter">${drink.strDrink}</h1>
                <p class="text-lg md:text-xl text-primary font-medium opacity-90">${drink.strTags || 'Delicious cocktail'}</p>
                <div class="flex flex-wrap gap-6 pt-4 border-t border-white/10 mt-6">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">local_bar</span>
                        <span class="text-sm font-semibold">${drink.strGlass || 'Glass'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">bolt</span>
                        <span class="text-sm font-semibold">${drink.strAlcoholic || 'Alcoholic'}</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <!-- Left Column: Ingredients -->
            <div class="lg:col-span-5 space-y-8">
                <section>
                    <div class="flex items-center gap-3 mb-6">
                        <div class="h-8 w-1 bg-primary rounded-full"></div>
                        <h2 class="text-2xl font-bold tracking-tight text-white">Ingredients</h2>
                    </div>
                    <div class="glass-card rounded-xl p-6 space-y-4">
                        ${ingredients}
                    </div>
                </section>
                <section>
                    <div class="flex items-center gap-3 mb-6">
                        <div class="h-8 w-1 bg-primary rounded-full"></div>
                        <h2 class="text-2xl font-bold tracking-tight text-white">Glassware</h2>
                    </div>
                    <div class="glass-card rounded-xl p-6 flex items-center gap-6">
                        <div class="h-16 w-16 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
                            <span class="material-symbols-outlined text-4xl">wine_bar</span>
                        </div>
                        <div>
                            <h3 class="font-bold text-white">${drink.strGlass || 'Cocktail Glass'}</h3>
                            <p class="text-sm text-slate-400">Perfect for this drink</p>
                        </div>
                    </div>
                </section>
            </div>
            <!-- Right Column: Preparation -->
            <div class="lg:col-span-7 space-y-8">
                <section>
                    <div class="flex items-center gap-3 mb-6">
                        <div class="h-8 w-1 bg-primary rounded-full"></div>
                        <h2 class="text-2xl font-bold tracking-tight text-white">Preparation</h2>
                    </div>
                    <div class="space-y-6">
                        ${instructions}
                    </div>
                </section>
            </div>
        </div>
        <!-- Tags Section -->
        <div class="mt-16 pt-8 border-t border-primary/10">
            <div class="flex flex-wrap gap-3">
                ${getTags(drink).map(tag => `
                    <div class="flex h-10 items-center justify-center gap-x-2 rounded-lg bg-surface-dark px-5 border border-primary/10 hover:border-primary/40 transition-colors">
                        <p class="text-slate-300 text-sm font-medium">${tag}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Search functionality
async function performSearch(query) {
    if (!query.trim()) return;

    const drinks = await searchCocktailsByName(query);
    displayCocktails(drinks);
}

// Pagination variables
let currentDrinks = [];
let currentPage = 0;

function displayCocktails(drinks) {
    currentDrinks = drinks;
    currentPage = 0;
    displayPage();
}

function displayPage() {
    const container = document.getElementById('cocktailGrid');
    if (!container) return;

    const start = currentPage * 12;
    const end = start + 12;
    const pageDrinks = currentDrinks.slice(start, end);

    container.innerHTML = '';
    if (pageDrinks.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center py-8">No cocktails found.</p>';
        return;
    }

    pageDrinks.forEach(drink => displayCocktailCard(drink, container));

    // Add pagination if more than 12 total
    if (currentDrinks.length > 12) {
        const pagination = document.createElement('div');
        pagination.className = 'flex justify-center items-center gap-4 mt-8';

        if (currentPage > 0) {
            const prev = document.createElement('button');
            prev.textContent = '← Previous';
            prev.className = 'px-4 py-2 bg-primary text-background-dark rounded-lg hover:bg-primary/80 transition-colors';
            prev.onclick = () => { currentPage--; displayPage(); window.scrollTo(0, 0); };
            pagination.appendChild(prev);
        }

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage + 1} of ${Math.ceil(currentDrinks.length / 12)}`;
        pageInfo.className = 'text-slate-400 text-sm';
        pagination.appendChild(pageInfo);

        if (end < currentDrinks.length) {
            const next = document.createElement('button');
            next.textContent = 'Next →';
            next.className = 'px-4 py-2 bg-primary text-background-dark rounded-lg hover:bg-primary/80 transition-colors';
            next.onclick = () => { currentPage++; displayPage(); window.scrollTo(0, 0); };
            pagination.appendChild(next);
        }

        container.appendChild(pagination);
    }
}

async function loadFavoriteCocktails() {
    const favIds = getFavorites();
    const promises = favIds.map(id => lookupCocktailById(id));
    const drinks = await Promise.all(promises);
    const validDrinks = drinks.filter(drink => drink);
    displayCocktails(validDrinks);
}

async function loadCocktailsByIngredients(ingredients) {
    const allDrinks = [];
    const seen = new Set();
    
    for (const ingredient of ingredients) {
        const drinks = await filterByIngredient(ingredient);
        for (const drink of drinks) {
            if (!seen.has(drink.idDrink)) {
                seen.add(drink.idDrink);
                allDrinks.push(drink);
            }
        }
    }
    
    displayCocktails(allDrinks);
}

async function loadCocktailsByGlass(glass) {
    const drinks = await filterByGlass(glass);
    displayCocktails(drinks);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Page-specific loading
    if (document.getElementById('featuredGrid')) {
        loadFeaturedCocktails();
    }
    
    if (document.getElementById('cocktailGrid') && window.location.pathname.includes('explorer.html')) {
        loadCocktailGrid();
        loadIngredientFilters();
    }
    
    if (document.getElementById('cocktailGrid') && window.location.pathname.includes('favorites.html')) {
        loadFavoriteCocktails();
    }
    
    if (document.getElementById('cocktailDetail')) {
        loadCocktailDetail();
    }

    // Auto load ingredients on inventory page
    if (document.getElementById('cocktailSelect')) {
        loadCocktailSelector();
    }

    // Search functionality (only on explorer)
    const searchInput = document.querySelector('input[placeholder*="Search"]');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                const query = this.value.trim();
                if (query) {
                    await performSearch(query);
                } else {
                    if (window.location.pathname.includes('explorer.html')) {
                        loadCocktailGrid();
                    } else if (window.location.pathname.includes('favorites.html')) {
                        loadFavoriteCocktails();
                    }
                }
            }, 500);
        });
    }

    // Category filters in sidebar (only on explorer)
    if (window.location.pathname.includes('explorer.html')) {
        document.querySelectorAll('.space-y-1 button').forEach(btn => {
            btn.addEventListener('click', function() {
                // prefer explicit data-category if present
                const category = this.dataset.category ? this.dataset.category.trim() : this.textContent.trim();
                loadCocktailGrid(category === 'All' ? 'All' : category);

                // Reset filters (limit to ingredientFilters container to avoid global side effects)
                const ingrContainer = document.getElementById('ingredientFilters');
                if (ingrContainer) ingrContainer.querySelectorAll('input.ingredient-checkbox').forEach(cb => cb.checked = false);
                document.querySelectorAll('input[type="radio"]').forEach(rb => rb.checked = false);

                // Update active state
                document.querySelectorAll('.space-y-1 button').forEach(b => b.classList.remove('bg-primary', 'text-background-dark'));
                this.classList.add('bg-primary', 'text-background-dark');
            });
        });

        // Ingredient filter checkboxes
        // Handled in loadIngredientFilters

        // Glass type radio buttons
        document.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', async () => {
                const selectedRadio = document.querySelector('input[type="radio"]:checked');
                if (selectedRadio) {
                    const glass = selectedRadio.value || selectedRadio.nextSibling && selectedRadio.nextSibling.textContent.trim();
                    await loadCocktailsByGlass(glass);
                } else {
                    loadCocktailGrid();
                }
            });
        });
    }
});