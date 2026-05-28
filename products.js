import { logAudit } from './audit.js';
import { apiFetch } from './apiClient.js';

const productsGrid = document.getElementById('productsGrid');

const noProducts = document.getElementById('noProducts');
const selectedProductTitle = document.getElementById('selectedProductTitle');
const selectedProductDetails = document.getElementById('selectedProductDetails');
const productMessage = document.getElementById('productMessage');
const addProductForm = document.getElementById('addProductForm');
const productImageFile = document.getElementById('productImageFile');

let productMessageTimeout = null;

function showProductMessage(message, duration = 5000) {
  if (!productMessage) return;
  productMessage.textContent = message;
  productMessage.classList.remove('hidden');
  if (productMessageTimeout) {
    clearTimeout(productMessageTimeout);
  }
  productMessageTimeout = setTimeout(() => {
    productMessage.classList.add('hidden');
    productMessageTimeout = null;
  }, duration);
}

function hideProductMessage() {
  if (!productMessage) return;
  productMessage.classList.add('hidden');
  if (productMessageTimeout) {
    clearTimeout(productMessageTimeout);
    productMessageTimeout = null;
  }
}

const productImageInput = document.getElementById('productImage');
const imagePreviewHolder = document.getElementById('imagePreviewHolder');
const imagePreview = document.getElementById('imagePreview');
const categoryFilter = document.getElementById('categoryFilter');
const productIdHidden = document.getElementById('productIdHidden');
const productFormTitle = document.getElementById('productFormTitle');
const productSubmitBtn = document.getElementById('productSubmitBtn');
const cancelProductEditBtn = document.getElementById('cancelProductEditBtn');

let currentProducts = {};
let activeCategory = 'all';
let editingProductId = null;

export async function loadProducts(role) {
  try {
    const data = await apiFetch('/api/products', { method: 'GET' });
    // backend returns { products: [{...}, ...] }
    const productsArr = data?.products || [];

    const productsById = {};
    for (const p of productsArr) {
      // backend returns lean docs without _id unless we add it.
      // so we support both shapes:
      // - { _id, ... }
      // - { id, ... }
      const id = p.id || p._id;
      if (id) productsById[id] = p;
    }

    currentProducts = productsById;
    renderCategoryFilter(productsById);
    renderProductCards(productsById, role, activeCategory);
    configureProductForm(role);
    return productsById;
  } catch (error) {
    console.error('Error loading products', error);
    productsGrid.innerHTML = '<div class="notification">Unable to load products right now.</div>';
    return {};
  }
}


export async function refreshProducts(role) {
  await loadProducts(role);
}

function configureProductForm(role) {
  if (!addProductForm) return;
  if (role !== 'manager') {
    addProductForm.classList.add('hidden');
    return;
  }
  addProductForm.classList.remove('hidden');
  resetProductForm();
}

function renderCategoryFilter(products) {
  if (!categoryFilter) return;
  const categories = new Set([
    'all',
    ...Object.values(products).map((product) => (product.category || 'Uncategorized').trim()),
    'Out of Stock'
  ]);

  categoryFilter.innerHTML = Array.from(categories)
    .map((category) => `
      <option value="${category.toLowerCase()}">${category}</option>`)
    .join('');

  categoryFilter.value = activeCategory;

  if (!categoryFilter.dataset.initialized) {
    categoryFilter.addEventListener('change', () => {
      activeCategory = categoryFilter.value;
      renderProductCards(currentProducts, window.currentUser?.role || 'rep', activeCategory);
    });
    categoryFilter.dataset.initialized = 'true';
  }
}

function createCardMarkup(productId, product, role) {
  const lowStock = product.stock > 0 && product.stock <= 3;
  const stockLabel = product.stock > 0 ? `${lowStock ? 'Low stock · ' : ''}Stock: ${product.stock}` : 'Out of stock';
  const badgeClass = lowStock ? 'badge low-stock' : 'badge';
  const marginLabel = role === 'manager' && product.cost > 0
    ? `Margin ${Math.round(((product.price - product.cost) / product.cost) * 100)}% · `
    : '';

  const restockButton = role === 'manager'
    ? `<button type="button" class="btn btn-secondary btn-icon restock-btn" data-product-id="${productId}" title="Restock ${product.name}">+</button>`
    : '';

  return `
    <article class="card" data-product-id="${productId}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-stock="${product.stock}" data-product-image="${product.image}" data-product-category="${product.category || 'Uncategorized'}" data-product-cost="${product.cost || 0}">
      <img src="${product.image}" alt="${product.name}" onerror="this.onerror=null; this.src='https://via.placeholder.com/400x300?text=No+Image';" />
      <div class="card-body">
        <div class="card-header">
          <div>
            <h4 class="card-title">${product.name}</h4>
            <p class="muted">GHS ${product.price.toFixed(2)} · ${product.category || 'Uncategorized'}</p>
          </div>
          ${restockButton}
        </div>
        <div>
          <span class="${badgeClass}">${marginLabel}${stockLabel}</span>
        </div>
      </div>
    </article>`;
}

function renderProductCards(products, role, category = 'all') {
  const productEntries = Object.entries(products).filter(([, product]) => {
    const normalizedCategory = (product.category || 'Uncategorized').trim();
    const effectiveCategory = Number(product.stock) <= 0 ? 'Out of Stock' : normalizedCategory;
    return category === 'all' || effectiveCategory.toLowerCase() === category.toLowerCase();
  });

  if (!productEntries.length) {
    noProducts.classList.remove('hidden');
    productsGrid.innerHTML = '';
    return;
  }

  noProducts.classList.add('hidden');
  productsGrid.innerHTML = productEntries
    .map(([id, product]) => createCardMarkup(id, product, role))
    .join('');

  const cards = productsGrid.querySelectorAll('.card');
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const selected = document.querySelector('.card.selected');
      if (selected) selected.classList.remove('selected');

      card.classList.add('selected');
      const item = {
        id: card.dataset.productId,
        name: card.dataset.productName,
        price: Number(card.dataset.productPrice),
        stock: Number(card.dataset.productStock),
        image: card.dataset.productImage,
        category: card.dataset.productCategory,
        cost: Number(card.dataset.productCost)
      };

      window.selectedProduct = item;
      selectedProductTitle.textContent = item.name;
      const costDisplay = window.currentUser?.role === 'manager' ? ` · Cost: GHS ${item.cost.toFixed(2)}` : '';
      selectedProductDetails.textContent = `Price: GHS ${item.price.toFixed(2)}${costDisplay} · Stock: ${item.stock}`;

      if (window.currentUser?.role === 'manager') {
        populateProductForm(item);
      }
    });

    const restockBtn = card.querySelector('.restock-btn');
    if (restockBtn) {
      restockBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        const productId = restockBtn.dataset.productId;
        await handleRestock(productId);
      });
    }
  });
}

async function handleRestock(productId) {
  const amountString = window.prompt('How many units would you like to add to stock?');
  if (!amountString) return;

  const amount = Number(amountString);
  if (!Number.isInteger(amount) || amount <= 0) {
    window.alert('Please enter a valid positive whole number.');
    return;
  }

  try {
    const product = currentProducts?.[productId];
    const currentStock = Number(product?.stock ?? 0);
    const newStock = currentStock + amount;

    // manager restock => PUT /api/products/:id
    await apiFetch(`/api/products/${productId}`, {
      method: 'PUT',
      body: { stock: newStock }
    });

    // keep existing UI/audit behavior if audit still points to Firebase
    await logAudit('PRODUCT_RESTOCKED', window.currentUser?.email || 'system', {
      productId,
      productName: product?.name,
      quantityAdded: amount,
      newStock
    });

    await refreshProducts(window.currentUser?.role || 'manager');
    if (window.refreshApp) {
      await window.refreshApp();
    }
  } catch (error) {
    console.error('Restock failed', error);
    window.alert('Unable to update stock at the moment.');
  }
}


function populateProductForm(item) {
  if (!addProductForm) return;
  editingProductId = item.id;
  productIdHidden.value = item.id;
  if (productFormTitle) productFormTitle.textContent = `Edit product: ${item.name}`;
  if (productSubmitBtn) productSubmitBtn.textContent = 'Save changes';
  if (cancelProductEditBtn) cancelProductEditBtn.classList.remove('hidden');

  document.getElementById('productName').value = item.name;
  document.getElementById('productPrice').value = item.price;
  document.getElementById('productCost').value = item.cost;
  document.getElementById('productCategory').value = item.category;
  document.getElementById('productStock').value = item.stock;
  productImageInput.value = item.image || '';
  if (productImageFile) productImageFile.value = '';

  showImagePreview(item.image);
}

function resetProductForm() {
  editingProductId = null;
  if (productIdHidden) productIdHidden.value = '';
  if (productFormTitle) productFormTitle.textContent = 'Add New Product';
  if (productSubmitBtn) productSubmitBtn.textContent = 'Add product';
  if (cancelProductEditBtn) cancelProductEditBtn.classList.add('hidden');
  if (addProductForm) addProductForm.reset();
  hideImagePreview();
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function hideImagePreview() {
  if (!imagePreviewHolder) return;
  imagePreviewHolder.classList.add('hidden');
  imagePreview.src = '';
}

function showImagePreview(src) {
  if (!imagePreviewHolder) return;
  imagePreview.src = src;
  imagePreviewHolder.classList.remove('hidden');
}

if (productImageFile) {
  productImageFile.addEventListener('change', () => {
    const file = productImageFile.files[0];
    if (file) {
      readFileAsDataURL(file)
        .then((dataUrl) => showImagePreview(dataUrl))
        .catch((error) => {
          console.error('Image preview error', error);
          hideImagePreview();
        });
    } else {
      hideImagePreview();
    }
  });
}

if (productImageInput) {
  productImageInput.addEventListener('input', () => {
    const url = productImageInput.value.trim();
    if (url) showImagePreview(url);
    else if (!productImageFile?.files?.length) hideImagePreview();
  });
}

if (cancelProductEditBtn) {
  cancelProductEditBtn.addEventListener('click', () => resetProductForm());
}

if (addProductForm) {
  addProductForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideProductMessage();

    const name = document.getElementById('productName').value.trim();
    const price = Number(document.getElementById('productPrice').value);
    const cost = Number(document.getElementById('productCost').value);
    const category = document.getElementById('productCategory').value.trim() || 'Uncategorized';
    const stock = Number(document.getElementById('productStock').value);
    const imageUrl = productImageInput.value.trim();
    const imageFile = productImageFile?.files?.[0] || null;
    const currentUser = window.currentUser || { email: 'system' };

    if (!name || !price || price <= 0 || cost < 0 || cost >= price || stock < 0 || (!imageUrl && !imageFile)) {
      showProductMessage('Please enter valid product details, including cost and category, and include an image URL or upload an image file.', 6000);
      return;
    }

    try {
      const image = imageFile ? await readFileAsDataURL(imageFile) : imageUrl;
      const productPayload = { name, price, cost, category, stock, image };

      if (editingProductId) {
        const res = await apiFetch(`/api/products/${editingProductId}`, {
          method: 'PUT',
          body: productPayload
        });

        await logAudit('PRODUCT_UPDATED', currentUser.email, {
          productId: editingProductId,
          ...res?.product
        });

        showProductMessage('Product updated successfully.', 6000);
      } else {
        const res = await apiFetch('/api/products', {
          method: 'POST',
          body: productPayload
        });

        const created = res?.product;

        await logAudit('PRODUCT_ADDED', currentUser.email, {
          productId: created?.id || created?._id,
          ...created
        });

        showProductMessage('Product added successfully.', 6000);
      }


      addProductForm.reset();
      hideImagePreview();
      resetProductForm();
      await refreshProducts('manager');
      window.refreshApp();
      console.log(editingProductId ? 'Product updated:' : 'Product added:', name);
    } catch (error) {
      console.error('Failed to save product', error);
      showProductMessage('Unable to save product at the moment.', 6000);
    }
  });
}

