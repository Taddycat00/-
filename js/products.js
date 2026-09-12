/**
 * 報價單管理系統 - 產品管理模組 (Phase 4 & Phase 7 & Phase 8)
 * 職責：
 * 1. 產品列表渲染 (Table & RWD) 與搜尋過濾
 * 2. 新增產品 (自動產生 P001~ 代碼)
 * 3. 編輯產品
 * 4. 查看產品詳細資訊 (Modal)
 * 5. 刪除產品 (防呆確認 Modal)
 * 6. 動態關聯「廠商管理」下拉選單（不硬編碼供應商）
 * 7. 表單驗證 (名稱、成本、售價、單位必填；成本與售價 >= 0 且為合理數值)
 */

import { StorageService } from './storage.js';

let currentEditingProductId = null;
let currentDeleteProductId = null;

export const ProductsModule = {
  init() {
    this.bindEvents();
    this.populateVendorDropdown();
    this.renderList();

    // 監聽廠商資料變動事件，即時刷新產品表單中的供應商下拉清單
    window.addEventListener('vendors-updated', () => {
      this.populateVendorDropdown();
      this.renderList(); // 同步刷新產品列表中的廠商名稱
    });
  },

  bindEvents() {
    const btnAdd = document.getElementById('btn-add-product');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddModal());
    }

    const productForm = document.getElementById('form-product');
    if (productForm) {
      productForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    const searchInput = document.getElementById('input-search-products');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    const btnConfirmDelete = document.getElementById('btn-confirm-delete-product');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => this.executeDelete());
    }
  },

  /**
   * 動態產生供應商下拉清單 (依據規範六：不要在 HTML 中大量寫死)
   */
  populateVendorDropdown() {
    const selectEl = document.getElementById('product-input-vendorId');
    if (!selectEl) return;

    const vendors = StorageService.getVendors();
    const currentValue = selectEl.value;

    selectEl.innerHTML = '<option value="">-- 請選擇供應廠商 (非必填) --</option>';
    vendors.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.vendorId;
      opt.textContent = `${v.companyName} (${v.vendorId})`;
      selectEl.appendChild(opt);
    });

    if (currentValue) {
      selectEl.value = currentValue;
    }
  },

  renderList(listOptional = null) {
    const list = listOptional !== null ? listOptional : StorageService.getProducts();
    const tbody = document.getElementById('table-products-body');
    const emptyState = document.getElementById('products-empty-state');
    const tableContainer = document.getElementById('products-table-container');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      if (emptyState) emptyState.classList.remove('d-none');
      if (tableContainer) tableContainer.classList.add('d-none');
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');
    if (tableContainer) tableContainer.classList.remove('d-none');

    list.forEach(product => {
      // 依 ID 查出關聯廠商名稱
      const vendor = product.vendorId ? StorageService.findVendorById(product.vendorId) : null;
      const vendorName = vendor ? vendor.companyName : (product.vendorId ? `廠商已移除 (${product.vendorId})` : '未指定');

      const tr = document.createElement('tr');
      tr.className = 'align-middle';
      tr.innerHTML = `
        <td class="fw-bold text-warning-emphasis font-monospace">${product.productId}</td>
        <td>
          <div class="fw-semibold text-dark">${escapeHtml(product.productName)}</div>
        </td>
        <td>
          <div class="small text-secondary text-truncate" style="max-width: 220px;" title="${escapeHtml(product.spec || product.description || '無規格說明')}">
            ${escapeHtml(product.spec || product.description || '-')}
          </div>
        </td>
        <td class="d-none d-md-table-cell">
          <span class="badge bg-light text-dark border"><i class="bi bi-tag me-1 text-muted"></i>${escapeHtml(product.brand || '自有')}</span>
        </td>
        <td>
          <span class="badge bg-secondary-subtle text-secondary">${escapeHtml(vendorName)}</span>
        </td>
        <td class="text-end font-monospace text-secondary">
          $${formatNumber(product.cost)}
        </td>
        <td class="text-end font-monospace fw-bold text-success">
          $${formatNumber(product.price)} <span class="small fw-normal text-muted">/ ${escapeHtml(product.unit)}</span>
        </td>
        <td class="text-center font-monospace d-none d-sm-table-cell">
          <span class="badge ${product.stockQty > 10 ? 'bg-success-subtle text-success' : (product.stockQty > 0 ? 'bg-warning-subtle text-warning' : 'bg-danger-subtle text-danger')}">
            ${product.stockQty ?? 0} ${escapeHtml(product.unit)}
          </span>
        </td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-info me-1 btn-view-product" data-id="${product.productId}" title="查看詳細">
            <i class="bi bi-eye"></i><span class="d-none d-sm-inline ms-1">查看</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-warning me-1 btn-edit-product" data-id="${product.productId}" title="編輯">
            <i class="bi bi-pencil-square"></i><span class="d-none d-sm-inline ms-1">編輯</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete-product" data-id="${product.productId}" title="刪除">
            <i class="bi bi-trash3"></i><span class="d-none d-sm-inline ms-1">刪除</span>
          </button>
        </td>
      `;

      tr.querySelector('.btn-view-product').addEventListener('click', () => this.viewDetail(product.productId));
      tr.querySelector('.btn-edit-product').addEventListener('click', () => this.openEditModal(product.productId));
      tr.querySelector('.btn-delete-product').addEventListener('click', () => this.promptDelete(product.productId));

      tbody.appendChild(tr);
    });
  },

  handleSearch(query) {
    const term = query.trim().toLowerCase();
    const products = StorageService.getProducts();
    if (!term) {
      this.renderList(products);
      return;
    }
    const filtered = products.filter(p => 
      p.productId.toLowerCase().includes(term) ||
      p.productName.toLowerCase().includes(term) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.spec && p.spec.toLowerCase().includes(term))
    );
    this.renderList(filtered);
  },

  openAddModal() {
    currentEditingProductId = null;
    const form = document.getElementById('form-product');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    this.populateVendorDropdown();

    const nextId = StorageService.generateNextId('product');
    const idInput = document.getElementById('product-input-id');
    if (idInput) idInput.value = nextId;

    document.getElementById('modal-product-title').textContent = '新增產品資料';
    const modalEl = document.getElementById('modal-product');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  openEditModal(id) {
    const product = StorageService.findProductById(id);
    if (!product) return;

    currentEditingProductId = id;
    const form = document.getElementById('form-product');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    this.populateVendorDropdown();

    document.getElementById('modal-product-title').textContent = `編輯產品資料 (${id})`;
    document.getElementById('product-input-id').value = product.productId;
    document.getElementById('product-input-name').value = product.productName || '';
    document.getElementById('product-input-cost').value = product.cost !== undefined ? product.cost : '';
    document.getElementById('product-input-price').value = product.price !== undefined ? product.price : '';
    document.getElementById('product-input-unit').value = product.unit || '';
    document.getElementById('product-input-brand').value = product.brand || '';
    document.getElementById('product-input-vendorId').value = product.vendorId || '';
    document.getElementById('product-input-stock').value = product.stockQty !== undefined ? product.stockQty : 0;
    document.getElementById('product-input-spec').value = product.spec || '';
    document.getElementById('product-input-description').value = product.description || '';
    document.getElementById('product-input-imageUrl').value = product.imageUrl || '';
    document.getElementById('product-input-notes').value = product.notes || '';

    const modalEl = document.getElementById('modal-product');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const isValid = validateProductForm(form);
    if (!isValid) {
      e.stopPropagation();
      return;
    }

    const costVal = parseFloat(document.getElementById('product-input-cost').value.trim());
    const priceVal = parseFloat(document.getElementById('product-input-price').value.trim());
    const stockVal = parseInt(document.getElementById('product-input-stock').value.trim() || '0', 10);

    const productData = {
      productId: document.getElementById('product-input-id').value.trim(),
      productName: document.getElementById('product-input-name').value.trim(),
      cost: costVal,
      price: priceVal,
      unit: document.getElementById('product-input-unit').value.trim(),
      brand: document.getElementById('product-input-brand').value.trim(),
      vendorId: document.getElementById('product-input-vendorId').value.trim(),
      stockQty: isNaN(stockVal) ? 0 : stockVal,
      spec: document.getElementById('product-input-spec').value.trim(),
      description: document.getElementById('product-input-description').value.trim(),
      imageUrl: document.getElementById('product-input-imageUrl').value.trim(),
      notes: document.getElementById('product-input-notes').value.trim()
    };

    let products = StorageService.getProducts();

    if (currentEditingProductId) {
      const index = products.findIndex(p => p.productId === currentEditingProductId);
      if (index !== -1) {
        products[index] = productData;
        showToast('產品資料更新成功', 'success');
      }
    } else {
      if (products.some(p => p.productId === productData.productId)) {
        showToast('產品代碼已存在，請重新產生', 'danger');
        return;
      }
      products.unshift(productData);
      showToast('產品資料新增成功', 'success');
    }

    StorageService.saveProducts(products);
    this.renderList();

    const modalEl = document.getElementById('modal-product');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // 通知外部更新 (包含報價單產品下拉選單與 Dashboard 統計)
    window.dispatchEvent(new CustomEvent('products-updated'));
    window.dispatchEvent(new CustomEvent('data-updated'));
  },

  viewDetail(id) {
    const product = StorageService.findProductById(id);
    if (!product) return;

    const vendor = product.vendorId ? StorageService.findVendorById(product.vendorId) : null;
    const vendorName = vendor ? `${vendor.companyName} (${vendor.vendorId})` : (product.vendorId ? `廠商 (${product.vendorId})` : '未指定');

    document.getElementById('view-prod-id').textContent = product.productId;
    document.getElementById('view-prod-name').textContent = product.productName;
    document.getElementById('view-prod-brand').textContent = product.brand || '自有';
    document.getElementById('view-prod-vendor').textContent = vendorName;
    document.getElementById('view-prod-cost').textContent = `$${formatNumber(product.cost)}`;
    document.getElementById('view-prod-price').textContent = `$${formatNumber(product.price)}`;
    document.getElementById('view-prod-unit').textContent = product.unit;
    document.getElementById('view-prod-stock').textContent = `${product.stockQty ?? 0} ${product.unit}`;
    document.getElementById('view-prod-spec').textContent = product.spec || '無規格資訊';
    document.getElementById('view-prod-desc').textContent = product.description || '無詳細說明';
    document.getElementById('view-prod-notes').textContent = product.notes || '無備註';

    const modalEl = document.getElementById('modal-view-product');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  promptDelete(id) {
    const product = StorageService.findProductById(id);
    if (!product) return;

    currentDeleteProductId = id;
    document.getElementById('delete-product-target-name').textContent = `${product.productName} (${product.productId})`;
    
    // 檢查是否有報價單已使用此產品
    const quotes = StorageService.getQuotes();
    const usedCount = quotes.filter(q => q.items && q.items.some(it => it.productId === id)).length;
    const warningEl = document.getElementById('delete-product-warning');
    if (usedCount > 0) {
      warningEl.innerHTML = `<i class="bi bi-info-circle-fill text-info me-1"></i> 提醒：已有 <strong>${usedCount}</strong> 張歷史報價單內含此產品，歷史報價單仍會保留當初報價的快照資料。`;
      warningEl.classList.remove('d-none');
    } else {
      warningEl.classList.add('d-none');
    }

    const modalEl = document.getElementById('modal-delete-product');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  executeDelete() {
    if (!currentDeleteProductId) return;
    let products = StorageService.getProducts();
    products = products.filter(p => p.productId !== currentDeleteProductId);
    StorageService.saveProducts(products);

    showToast(`產品代碼 ${currentDeleteProductId} 已安全刪除`, 'info');
    currentDeleteProductId = null;

    const modalEl = document.getElementById('modal-delete-product');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    this.renderList();
    window.dispatchEvent(new CustomEvent('products-updated'));
    window.dispatchEvent(new CustomEvent('data-updated'));
  }
};

function validateProductForm(form) {
  let isValid = true;
  clearCustomErrors(form);

  const nameEl = document.getElementById('product-input-name');
  if (!nameEl || !nameEl.value.trim()) {
    setFieldError(nameEl, '請填寫產品名稱');
    isValid = false;
  }

  const unitEl = document.getElementById('product-input-unit');
  if (!unitEl || !unitEl.value.trim()) {
    setFieldError(unitEl, '請填寫單位 (如：台、組、式、個)');
    isValid = false;
  }

  const costEl = document.getElementById('product-input-cost');
  if (!costEl || costEl.value.trim() === '') {
    setFieldError(costEl, '請填寫成本金額');
    isValid = false;
  } else {
    const val = parseFloat(costEl.value);
    if (isNaN(val) || val < 0) {
      setFieldError(costEl, '成本金額不可為負數');
      isValid = false;
    }
  }

  const priceEl = document.getElementById('product-input-price');
  if (!priceEl || priceEl.value.trim() === '') {
    setFieldError(priceEl, '請填寫售價金額');
    isValid = false;
  } else {
    const val = parseFloat(priceEl.value);
    if (isNaN(val) || val < 0) {
      setFieldError(priceEl, '售價金額不可為負數');
      isValid = false;
    }
  }

  const stockEl = document.getElementById('product-input-stock');
  if (stockEl && stockEl.value.trim() !== '') {
    const val = parseInt(stockEl.value, 10);
    if (isNaN(val) || val < 0) {
      setFieldError(stockEl, '庫存數量不可為負數');
      isValid = false;
    }
  }

  return isValid;
}

function setFieldError(element, message) {
  element.classList.add('is-invalid');
  const parent = element.parentElement;
  let feedback = parent.querySelector('.invalid-feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    parent.appendChild(feedback);
  }
  feedback.textContent = message;
}

function clearCustomErrors(form) {
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('zh-TW');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  if (window.showAppToast) {
    window.showAppToast(message, type);
  }
}
