/**
 * 報價單管理系統 - 報價單管理與多產品明細模組 (Phase 5 & Phase 7 & Phase 8)
 * 職責：
 * 1. 報價單列表渲染 (Table & RWD) 與搜尋過濾
 * 2. 新增報價單 (自動產生 Q001~ 代碼)
 * 3. 選擇客戶自動帶入地址與聯絡電話 (但使用者仍可編輯修改)
 * 4. 多產品明細動態管理：
 *    - ＋ 新增產品明細
 *    - － 移除產品明細
 *    - 選擇產品後自動帶入「售價」與「說明」
 *    - 輸入數量後即時計算「單價 × 數量 = 復價」
 *    - 所有明細復價加總 = 總價 (即時更新)
 * 5. 防呆限制：至少需 1 筆明細、數量必須 > 0、單價不得為負數
 * 6. 查看正式報價單 (含列印友善功能)
 * 7. 編輯與刪除報價單 (確認 Modal)
 */

import { StorageService } from './storage.js';

let currentEditingQuoteId = null;
let currentDeleteQuoteId = null;

export const QuotesModule = {
  init() {
    this.bindEvents();
    this.populateCustomerDropdown();
    this.renderList();

    // 監聽客戶與產品資料變動事件
    window.addEventListener('data-updated', () => {
      this.populateCustomerDropdown();
      this.renderList();
    });
  },

  bindEvents() {
    // 新增報價單按鈕
    const btnAdd = document.getElementById('btn-add-quote');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddModal());
    }

    // 快速新增報價單 (Dashboard 捷徑)
    const btnQuick = document.getElementById('btn-quick-new-quote');
    if (btnQuick) {
      btnQuick.addEventListener('click', () => {
        window.location.hash = '#quotes';
        setTimeout(() => this.openAddModal(), 100);
      });
    }

    // 報價單表單送出
    const quoteForm = document.getElementById('form-quote');
    if (quoteForm) {
      quoteForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // 搜尋報價單
    const searchInput = document.getElementById('input-search-quotes');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // 報價單客戶下拉選單變更 -> 自動帶入電話與地址
    const selectCustomer = document.getElementById('quote-input-customerId');
    if (selectCustomer) {
      selectCustomer.addEventListener('change', (e) => this.handleCustomerSelect(e.target.value));
    }

    // 動態新增產品明細按鈕
    const btnAddItem = document.getElementById('btn-add-quote-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => this.addQuoteItemRow());
    }

    // 刪除確認按鈕
    const btnConfirmDelete = document.getElementById('btn-confirm-delete-quote');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => this.executeDelete());
    }

    // 列印報價單按鈕
    const btnPrintQuote = document.getElementById('btn-print-quote');
    if (btnPrintQuote) {
      btnPrintQuote.addEventListener('click', () => window.print());
    }
  },

  /**
   * 動態產生客戶下拉清單 (依據規範七：不要在 HTML 中寫死)
   */
  populateCustomerDropdown() {
    const selectEl = document.getElementById('quote-input-customerId');
    if (!selectEl) return;

    const customers = StorageService.getCustomers();
    const currentValue = selectEl.value;

    selectEl.innerHTML = '<option value="">-- 請選擇客戶 * --</option>';
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.customerId;
      opt.textContent = `${c.companyName} (${c.customerId})`;
      selectEl.appendChild(opt);
    });

    if (currentValue) {
      selectEl.value = currentValue;
    }
  },

  /**
   * 當選擇客戶時，自動帶入該客戶之聯絡電話與地址
   * @param {string} customerId 
   */
  handleCustomerSelect(customerId) {
    if (!customerId) return;
    const customer = StorageService.findCustomerById(customerId);
    if (!customer) return;

    const phoneInput = document.getElementById('quote-input-phone');
    const addressInput = document.getElementById('quote-input-address');

    if (phoneInput && !phoneInput.value.trim()) {
      phoneInput.value = customer.phone || '';
    }
    if (addressInput && !addressInput.value.trim()) {
      addressInput.value = customer.address || '';
    }
  },

  renderList(listOptional = null) {
    const list = listOptional !== null ? listOptional : StorageService.getQuotes();
    const tbody = document.getElementById('table-quotes-body');
    const emptyState = document.getElementById('quotes-empty-state');
    const tableContainer = document.getElementById('quotes-table-container');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      if (emptyState) emptyState.classList.remove('d-none');
      if (tableContainer) tableContainer.classList.add('d-none');
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');
    if (tableContainer) tableContainer.classList.remove('d-none');

    list.forEach(quote => {
      const customer = quote.customerId ? StorageService.findCustomerById(quote.customerId) : null;
      const customerName = customer ? customer.companyName : (quote.customerId ? `已刪除客戶 (${quote.customerId})` : '未知客戶');
      const itemCount = quote.items ? quote.items.length : 0;

      const tr = document.createElement('tr');
      tr.className = 'align-middle';
      tr.innerHTML = `
        <td class="fw-bold text-info-emphasis font-monospace">${quote.quoteId}</td>
        <td>
          <div class="fw-semibold text-dark">${escapeHtml(customerName)}</div>
          <div class="small text-muted"><i class="bi bi-person me-1"></i>${escapeHtml(quote.quoteStaff)} · <i class="bi bi-telephone me-1"></i>${escapeHtml(quote.contactPhone)}</div>
        </td>
        <td class="d-none d-md-table-cell">
          <div class="small text-dark">${escapeHtml(quote.quoteDate || '即期')}</div>
          <div class="small text-muted">有效期限：${escapeHtml(quote.validityDate || '一個月')}</div>
        </td>
        <td class="text-center">
          <span class="badge bg-light text-dark border font-monospace">${itemCount} 項品目</span>
        </td>
        <td class="text-end font-monospace fw-bold text-primary fs-6">
          $${formatNumber(quote.totalAmount)}
        </td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-info me-1 btn-view-quote" data-id="${quote.quoteId}" title="查看與列印報價單">
            <i class="bi bi-file-earmark-pdf"></i><span class="d-none d-sm-inline ms-1">查看</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary me-1 btn-edit-quote" data-id="${quote.quoteId}" title="編輯報價單">
            <i class="bi bi-pencil-square"></i><span class="d-none d-sm-inline ms-1">編輯</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete-quote" data-id="${quote.quoteId}" title="刪除報價單">
            <i class="bi bi-trash3"></i><span class="d-none d-sm-inline ms-1">刪除</span>
          </button>
        </td>
      `;

      tr.querySelector('.btn-view-quote').addEventListener('click', () => this.viewDetail(quote.quoteId));
      tr.querySelector('.btn-edit-quote').addEventListener('click', () => this.openEditModal(quote.quoteId));
      tr.querySelector('.btn-delete-quote').addEventListener('click', () => this.promptDelete(quote.quoteId));

      tbody.appendChild(tr);
    });
  },

  handleSearch(query) {
    const term = query.trim().toLowerCase();
    const quotes = StorageService.getQuotes();
    if (!term) {
      this.renderList(quotes);
      return;
    }
    const filtered = quotes.filter(q => {
      const customer = StorageService.findCustomerById(q.customerId);
      const customerName = customer ? customer.companyName.toLowerCase() : '';
      return (
        q.quoteId.toLowerCase().includes(term) ||
        q.quoteStaff.toLowerCase().includes(term) ||
        customerName.includes(term) ||
        (q.contactPhone && q.contactPhone.includes(term))
      );
    });
    this.renderList(filtered);
  },

  /**
   * 打開新增報價單 Modal
   */
  openAddModal() {
    currentEditingQuoteId = null;
    const form = document.getElementById('form-quote');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    this.populateCustomerDropdown();

    const nextId = StorageService.generateNextId('quote');
    document.getElementById('quote-input-id').value = nextId;

    // 預設日期為今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('quote-input-date').value = today;
    
    // 預設有效期限為 30 天後
    const validity = new Date();
    validity.setDate(validity.getDate() + 30);
    document.getElementById('quote-input-validity').value = validity.toISOString().split('T')[0];

    document.getElementById('quote-input-staff').value = '系統管理員';

    // 清空明細列表，預設加入一筆空白明細列
    const itemsTbody = document.getElementById('quote-items-tbody');
    itemsTbody.innerHTML = '';
    this.addQuoteItemRow();

    this.calculateTotal();

    document.getElementById('modal-quote-title').textContent = '新增報價單';
    const modalEl = document.getElementById('modal-quote');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  /**
   * 打開編輯報價單 Modal
   * @param {string} id 
   */
  openEditModal(id) {
    const quote = StorageService.findQuoteById(id);
    if (!quote) return;

    currentEditingQuoteId = id;
    const form = document.getElementById('form-quote');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    this.populateCustomerDropdown();

    document.getElementById('modal-quote-title').textContent = `編輯報價單 (${id})`;
    document.getElementById('quote-input-id').value = quote.quoteId;
    document.getElementById('quote-input-customerId').value = quote.customerId;
    document.getElementById('quote-input-staff').value = quote.quoteStaff || '';
    document.getElementById('quote-input-phone').value = quote.contactPhone || '';
    document.getElementById('quote-input-address').value = quote.contactAddress || '';
    document.getElementById('quote-input-date').value = quote.quoteDate || '';
    document.getElementById('quote-input-validity').value = quote.validityDate || '';
    document.getElementById('quote-input-notes').value = quote.notes || '';

    // 渲染明細列
    const itemsTbody = document.getElementById('quote-items-tbody');
    itemsTbody.innerHTML = '';

    if (quote.items && quote.items.length > 0) {
      quote.items.forEach(item => {
        this.addQuoteItemRow(item);
      });
    } else {
      this.addQuoteItemRow();
    }

    this.calculateTotal();

    const modalEl = document.getElementById('modal-quote');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  /**
   * 動態新增一列產品明細 (符合規範八)
   * @param {Object|null} itemData 
   */
  addQuoteItemRow(itemData = null) {
    const tbody = document.getElementById('quote-items-tbody');
    if (!tbody) return;

    const products = StorageService.getProducts();
    const rowId = `item-row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = 'quote-item-row align-top';

    // 產生產品選項
    let productOptions = '<option value="">-- 請選擇產品 * --</option>';
    products.forEach(p => {
      const selected = itemData && itemData.productId === p.productId ? 'selected' : '';
      productOptions += `<option value="${p.productId}" ${selected}>${escapeHtml(p.productName)} ($${formatNumber(p.price)}/${escapeHtml(p.unit)})</option>`;
    });

    const initialPrice = itemData ? itemData.unitPrice : 0;
    const initialQty = itemData ? itemData.quantity : 1;
    const initialDesc = itemData ? (itemData.description || '') : '';
    const initialSubtotal = itemData ? itemData.subtotal : (initialPrice * initialQty);

    tr.innerHTML = `
      <td style="min-width: 200px;">
        <select class="form-select form-select-sm item-select-product" required>
          ${productOptions}
        </select>
        <div class="invalid-feedback">請選擇產品</div>
      </td>
      <td style="min-width: 140px;">
        <div class="input-group input-group-sm">
          <span class="input-group-text">$</span>
          <input type="number" class="form-control item-input-price font-monospace" min="0" step="any" value="${initialPrice}" required />
        </div>
      </td>
      <td style="min-width: 100px;">
        <input type="number" class="form-control form-control-sm item-input-qty font-monospace" min="1" step="1" value="${initialQty}" required />
        <div class="invalid-feedback">數量需 ≥ 1</div>
      </td>
      <td style="min-width: 180px;">
        <input type="text" class="form-control form-control-sm item-input-desc" placeholder="規格或說明 (選填)" value="${escapeHtml(initialDesc)}" />
      </td>
      <td style="min-width: 120px;" class="text-end font-monospace fw-bold pt-2 text-primary item-text-subtotal">
        $${formatNumber(initialSubtotal)}
      </td>
      <td class="text-center text-nowrap pt-1">
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove-item" title="移除此品目">
          <i class="bi bi-dash-circle"></i>
        </button>
      </td>
    `;

    // 綁定產品選擇事件：自動帶入產品售價與產品說明
    const selectProduct = tr.querySelector('.item-select-product');
    const inputPrice = tr.querySelector('.item-input-price');
    const inputDesc = tr.querySelector('.item-input-desc');
    const inputQty = tr.querySelector('.item-input-qty');
    const btnRemove = tr.querySelector('.btn-remove-item');

    selectProduct.addEventListener('change', (e) => {
      const pId = e.target.value;
      if (pId) {
        const prod = StorageService.findProductById(pId);
        if (prod) {
          inputPrice.value = prod.price || 0;
          inputDesc.value = prod.description || prod.spec || '';
          this.recalcRow(tr);
        }
      } else {
        inputPrice.value = 0;
        inputDesc.value = '';
        this.recalcRow(tr);
      }
    });

    // 綁定價格與數量變更事件：即時重算復價與總價
    inputPrice.addEventListener('input', () => this.recalcRow(tr));
    inputQty.addEventListener('input', () => this.recalcRow(tr));

    // 綁定移除按鈕
    btnRemove.addEventListener('click', () => {
      const allRows = tbody.querySelectorAll('.quote-item-row');
      if (allRows.length <= 1) {
        showToast('報價單至少必須保留一項產品明細', 'warning');
        return;
      }
      tr.remove();
      this.calculateTotal();
    });

    tbody.appendChild(tr);
    this.calculateTotal();
  },

  /**
   * 計算單一明細列的復價 (單價 × 數量 = 復價)
   * @param {HTMLElement} tr 
   */
  recalcRow(tr) {
    const inputPrice = tr.querySelector('.item-input-price');
    const inputQty = tr.querySelector('.item-input-qty');
    const textSubtotal = tr.querySelector('.item-text-subtotal');

    const price = parseFloat(inputPrice.value) || 0;
    const qty = parseInt(inputQty.value, 10) || 0;
    const subtotal = price * qty;

    textSubtotal.textContent = `$${formatNumber(subtotal)}`;
    tr.dataset.subtotal = subtotal;

    this.calculateTotal();
  },

  /**
   * 計算所有明細之復價總和 (總價)
   */
  calculateTotal() {
    const rows = document.querySelectorAll('#quote-items-tbody .quote-item-row');
    let total = 0;
    rows.forEach(row => {
      const price = parseFloat(row.querySelector('.item-input-price')?.value) || 0;
      const qty = parseInt(row.querySelector('.item-input-qty')?.value, 10) || 0;
      total += (price * qty);
    });

    const totalEl = document.getElementById('quote-display-total');
    if (totalEl) {
      totalEl.textContent = `$${formatNumber(total)}`;
    }
    return total;
  },

  /**
   * 處理報價單表單提交
   */
  handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;

    // 表單驗證
    const isValid = validateQuoteForm(form);
    if (!isValid) {
      e.stopPropagation();
      return;
    }

    // 收集各品項明細
    const rows = document.querySelectorAll('#quote-items-tbody .quote-item-row');
    const items = [];
    let itemsValid = true;

    rows.forEach(row => {
      const selectProduct = row.querySelector('.item-select-product');
      const inputPrice = row.querySelector('.item-input-price');
      const inputQty = row.querySelector('.item-input-qty');
      const inputDesc = row.querySelector('.item-input-desc');

      const productId = selectProduct.value.trim();
      const unitPrice = parseFloat(inputPrice.value);
      const quantity = parseInt(inputQty.value, 10);
      const description = inputDesc.value.trim();

      if (!productId) {
        selectProduct.classList.add('is-invalid');
        itemsValid = false;
      } else {
        selectProduct.classList.remove('is-invalid');
      }

      if (isNaN(quantity) || quantity <= 0) {
        inputQty.classList.add('is-invalid');
        itemsValid = false;
      } else {
        inputQty.classList.remove('is-invalid');
      }

      const product = StorageService.findProductById(productId);
      const productName = product ? product.productName : '未知產品';
      const subtotal = (unitPrice || 0) * (quantity || 0);

      items.push({
        productId,
        productName,
        unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
        quantity: isNaN(quantity) ? 1 : quantity,
        description,
        subtotal
      });
    });

    if (!itemsValid || items.length === 0) {
      showToast('請確認所有產品明細皆已選擇產品且數量大於 0', 'danger');
      return;
    }

    const totalAmount = items.reduce((acc, it) => acc + it.subtotal, 0);

    const quoteData = {
      quoteId: document.getElementById('quote-input-id').value.trim(),
      customerId: document.getElementById('quote-input-customerId').value.trim(),
      quoteStaff: document.getElementById('quote-input-staff').value.trim(),
      contactPhone: document.getElementById('quote-input-phone').value.trim(),
      contactAddress: document.getElementById('quote-input-address').value.trim(),
      quoteDate: document.getElementById('quote-input-date').value.trim(),
      validityDate: document.getElementById('quote-input-validity').value.trim(),
      notes: document.getElementById('quote-input-notes').value.trim(),
      items,
      totalAmount
    };

    let quotes = StorageService.getQuotes();

    if (currentEditingQuoteId) {
      const index = quotes.findIndex(q => q.quoteId === currentEditingQuoteId);
      if (index !== -1) {
        quotes[index] = quoteData;
        showToast('報價單更新成功', 'success');
      }
    } else {
      if (quotes.some(q => q.quoteId === quoteData.quoteId)) {
        showToast('報價單號已存在，請重新產生', 'danger');
        return;
      }
      quotes.unshift(quoteData);
      showToast('報價單開立成功', 'success');
    }

    StorageService.saveQuotes(quotes);
    this.renderList();

    const modalEl = document.getElementById('modal-quote');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    window.dispatchEvent(new CustomEvent('data-updated'));
  },

  /**
   * 查看正式報價單 (含美觀排版與列印)
   * @param {string} id 
   */
  viewDetail(id) {
    const quote = StorageService.findQuoteById(id);
    if (!quote) return;

    const customer = quote.customerId ? StorageService.findCustomerById(quote.customerId) : null;

    document.getElementById('view-q-id').textContent = quote.quoteId;
    document.getElementById('view-q-date').textContent = quote.quoteDate || '--';
    document.getElementById('view-q-validity').textContent = quote.validityDate || '開立日起 30 日內有效';
    document.getElementById('view-q-staff').textContent = quote.quoteStaff;
    document.getElementById('view-q-phone').textContent = quote.contactPhone;
    document.getElementById('view-q-address').textContent = quote.contactAddress;
    document.getElementById('view-q-notes').textContent = quote.notes || '無特殊約定條款';

    if (customer) {
      document.getElementById('view-q-customer-name').textContent = customer.companyName;
      document.getElementById('view-q-customer-contact').textContent = `${customer.contactPerson} (${customer.department} / ${customer.jobTitle || '無'})`;
      document.getElementById('view-q-customer-taxId').textContent = customer.taxId;
    } else {
      document.getElementById('view-q-customer-name').textContent = `已刪除客戶 (${quote.customerId})`;
      document.getElementById('view-q-customer-contact').textContent = '--';
      document.getElementById('view-q-customer-taxId').textContent = '--';
    }

    // 渲染明細表格
    const itemsTbody = document.getElementById('view-q-items-tbody');
    itemsTbody.innerHTML = '';

    if (quote.items && quote.items.length > 0) {
      quote.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-center font-monospace">${index + 1}</td>
          <td>
            <div class="fw-bold text-dark">${escapeHtml(item.productName)}</div>
            ${item.description ? `<div class="small text-muted">${escapeHtml(item.description)}</div>` : ''}
          </td>
          <td class="text-end font-monospace">$${formatNumber(item.unitPrice)}</td>
          <td class="text-center font-monospace">${item.quantity}</td>
          <td class="text-end font-monospace fw-bold">$${formatNumber(item.subtotal)}</td>
        `;
        itemsTbody.appendChild(tr);
      });
    }

    document.getElementById('view-q-total').textContent = `$${formatNumber(quote.totalAmount)}`;

    const modalEl = document.getElementById('modal-view-quote');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  promptDelete(id) {
    const quote = StorageService.findQuoteById(id);
    if (!quote) return;

    currentDeleteQuoteId = id;
    document.getElementById('delete-quote-target-name').textContent = `報價單號 ${quote.quoteId} (總計 $${formatNumber(quote.totalAmount)})`;

    const modalEl = document.getElementById('modal-delete-quote');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  executeDelete() {
    if (!currentDeleteQuoteId) return;
    let quotes = StorageService.getQuotes();
    quotes = quotes.filter(q => q.quoteId !== currentDeleteQuoteId);
    StorageService.saveQuotes(quotes);

    showToast(`報價單號 ${currentDeleteQuoteId} 已安全刪除`, 'info');
    currentDeleteQuoteId = null;

    const modalEl = document.getElementById('modal-delete-quote');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    this.renderList();
    window.dispatchEvent(new CustomEvent('data-updated'));
  }
};

function validateQuoteForm(form) {
  let isValid = true;
  clearCustomErrors(form);

  const customerEl = document.getElementById('quote-input-customerId');
  if (!customerEl || !customerEl.value.trim()) {
    setFieldError(customerEl, '請選擇報價客戶');
    isValid = false;
  }

  const staffEl = document.getElementById('quote-input-staff');
  if (!staffEl || !staffEl.value.trim()) {
    setFieldError(staffEl, '請填寫報價人員姓名');
    isValid = false;
  }

  const phoneEl = document.getElementById('quote-input-phone');
  if (!phoneEl || !phoneEl.value.trim()) {
    setFieldError(phoneEl, '請填寫聯絡電話');
    isValid = false;
  } else {
    const phoneRegex = /^[\d\-+()#\s]{7,20}$/;
    if (!phoneRegex.test(phoneEl.value.trim())) {
      setFieldError(phoneEl, '請輸入有效之電話號碼格式');
      isValid = false;
    }
  }

  const addressEl = document.getElementById('quote-input-address');
  if (!addressEl || !addressEl.value.trim()) {
    setFieldError(addressEl, '請填寫聯絡地址');
    isValid = false;
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
