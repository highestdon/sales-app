import { logAudit } from './audit.js';
import { apiFetch } from './apiClient.js';



const saleForm = document.getElementById('saleForm');
const saleQuantity = document.getElementById('saleQuantity');
const saleMessage = document.getElementById('saleMessage');
const selectedProductTitle = document.getElementById('selectedProductTitle');
const selectedProductDetails = document.getElementById('selectedProductDetails');

let saleMessageTimeout = null;

function showSaleMessage(message, duration = 5000) {
  if (!saleMessage) return;
  saleMessage.textContent = message;
  saleMessage.classList.remove('hidden');
  if (saleMessageTimeout) {
    clearTimeout(saleMessageTimeout);
  }
  saleMessageTimeout = setTimeout(() => {
    saleMessage.classList.add('hidden');
    saleMessageTimeout = null;
  }, duration);
}

function hideSaleMessage() {
  if (!saleMessage) return;
  saleMessage.classList.add('hidden');
  if (saleMessageTimeout) {
    clearTimeout(saleMessageTimeout);
    saleMessageTimeout = null;
  }
}

export function setupSalePanel(currentUser) {
  if (!saleForm) return;

  saleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideSaleMessage();

    const selectedProduct = window.selectedProduct;
    const quantity = Number(saleQuantity.value);

    if (!selectedProduct) {
      showSaleMessage('Please select a product before recording a sale.', 6000);
      return;
    }

    if (!quantity || quantity <= 0) {
      showSaleMessage('Enter a valid quantity greater than 0.', 6000);
      return;
    }

    try {
      await recordSale(selectedProduct, quantity, currentUser);
      showSaleMessage(
        currentUser.role === 'manager'
          ? 'Sale recorded successfully and approved.'
          : 'Sale recorded successfully and is pending approval.',
        6000
      );

      saleForm.reset();
      selectedProductTitle.textContent = 'Select a product';
      selectedProductDetails.textContent = 'Tap a product card to start.';
      window.selectedProduct = null;
      window.refreshApp();
    } catch (error) {
      console.error('Sale recording failed', error);
      showSaleMessage(error.message || 'Unable to record sale. Try again.', 6000);
    }
  });
}

export async function recordSale(product, quantity, currentUser) {
  // call Mongo REST API; backend handles stock validation + commission fields + status
  const res = await apiFetch('/api/sales', {
    method: 'POST',
    body: {
      productId: product.id,
      quantity
    }
  });

  // keep current UI/audit signaling; audit.js may still write to Firebase for now
  // if backend audit endpoint is implemented later, we'll switch to it.
  const status = res?.sale?.status;

  if (status === 'approved' || currentUser.role === 'manager') {
    await logAudit('SALE_CREATED_APPROVED', currentUser.email, {
      saleId: res?.sale?.id || res?.sale?._id,
      productId: product.id,
      productName: product.name,
      quantity,
      total: res?.sale?.total,
      status: 'approved'
    });
  } else {
    await logAudit('SALE_CREATED', currentUser.email, {
      saleId: res?.sale?.id || res?.sale?._id,
      productId: product.id,
      productName: product.name,
      quantity,
      total: res?.sale?.total
    });
  }
}


