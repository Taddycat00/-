/**
 * 報價單管理系統 - 客戶管理模組 (Phase 2 & Phase 7 & Phase 8)
 * 職責：
 * 1. 客戶列表渲染 (Table & RWD) 與搜尋過濾
 * 2. 新增客戶 (自動產生 C001~ 代碼)
 * 3. 編輯客戶
 * 4. 查看客戶詳細資訊 (Modal)
 * 5. 刪除客戶 (防呆確認 Modal)
 * 6. 表單驗證 (所有 * 必填、統編 8 位、Email、電話格式驗證)
 */

import { StorageService } from './storage.js';

let currentEditingCustomerId = null;
let currentDeleteCustomerId = null;

export const CustomersModule = {
  init() {
    this.bindEvents();
    this.renderList();
  },

  bindEvents() {
    // 新增客戶按鈕點擊
    const btnAdd = document.getElementById('btn-add-customer');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddModal());
    }

    // 客戶表單送出事件
    const customerForm = document.getElementById('form-customer');
    if (customerForm) {
      customerForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // 客戶搜尋輸入事件
    const searchInput = document.getElementById('input-search-customers');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // 刪除確認按鈕
    const btnConfirmDelete = document.getElementById('btn-confirm-delete-customer');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => this.executeDelete());
    }
  },

  /**
   * 渲染客戶列表表格
   * @param {Array} listOptional 
   */
  renderList(listOptional = null) {
    const list = listOptional !== null ? listOptional : StorageService.getCustomers();
    const tbody = document.getElementById('table-customers-body');
    const emptyState = document.getElementById('customers-empty-state');
    const tableContainer = document.getElementById('customers-table-container');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      if (emptyState) emptyState.classList.remove('d-none');
      if (tableContainer) tableContainer.classList.add('d-none');
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');
    if (tableContainer) tableContainer.classList.remove('d-none');

    list.forEach(customer => {
      const tr = document.createElement('tr');
      tr.className = 'align-middle';
      tr.innerHTML = `
        <td class="fw-bold text-primary font-monospace">${customer.customerId}</td>
        <td>
          <div class="fw-semibold text-dark">${escapeHtml(customer.companyName)}</div>
          <div class="small text-muted">${customer.englishName ? escapeHtml(customer.englishName) : '統編：' + escapeHtml(customer.taxId)}</div>
        </td>
        <td>
          <div>${escapeHtml(customer.contactPerson)}</div>
          <span class="badge bg-light text-secondary border">${escapeHtml(customer.department)} / ${escapeHtml(customer.jobTitle || '無')}</span>
        </td>
        <td>
          <div class="small text-dark"><i class="bi bi-telephone text-muted me-1"></i>${escapeHtml(customer.phone)}</div>
          <div class="small text-muted"><i class="bi bi-envelope text-muted me-1"></i>${escapeHtml(customer.email)}</div>
        </td>
        <td class="d-none d-md-table-cell">
          <span class="badge bg-secondary-subtle text-secondary">${escapeHtml(customer.paymentTerms || '一般條款')}</span>
        </td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-info me-1 btn-view-customer" data-id="${customer.customerId}" title="查看詳細">
            <i class="bi bi-eye"></i><span class="d-none d-sm-inline ms-1">查看</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-primary me-1 btn-edit-customer" data-id="${customer.customerId}" title="編輯">
            <i class="bi bi-pencil-square"></i><span class="d-none d-sm-inline ms-1">編輯</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete-customer" data-id="${customer.customerId}" title="刪除">
            <i class="bi bi-trash3"></i><span class="d-none d-sm-inline ms-1">刪除</span>
          </button>
        </td>
      `;

      // 綁定操作按鈕事件
      tr.querySelector('.btn-view-customer').addEventListener('click', () => this.viewDetail(customer.customerId));
      tr.querySelector('.btn-edit-customer').addEventListener('click', () => this.openEditModal(customer.customerId));
      tr.querySelector('.btn-delete-customer').addEventListener('click', () => this.promptDelete(customer.customerId));

      tbody.appendChild(tr);
    });
  },

  handleSearch(query) {
    const term = query.trim().toLowerCase();
    const customers = StorageService.getCustomers();
    if (!term) {
      this.renderList(customers);
      return;
    }
    const filtered = customers.filter(c => 
      c.customerId.toLowerCase().includes(term) ||
      c.companyName.toLowerCase().includes(term) ||
      c.contactPerson.toLowerCase().includes(term) ||
      c.taxId.includes(term) ||
      c.phone.includes(term) ||
      c.email.toLowerCase().includes(term)
    );
    this.renderList(filtered);
  },

  /**
   * 打開新增客戶 Modal
   */
  openAddModal() {
    currentEditingCustomerId = null;
    const form = document.getElementById('form-customer');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    // 自動產生客戶代碼
    const nextId = StorageService.generateNextId('customer');
    const idInput = document.getElementById('customer-input-id');
    if (idInput) idInput.value = nextId;

    document.getElementById('modal-customer-title').textContent = '新增客戶資料';
    const modalEl = document.getElementById('modal-customer');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  /**
   * 打開編輯客戶 Modal
   * @param {string} id 
   */
  openEditModal(id) {
    const customer = StorageService.findCustomerById(id);
    if (!customer) return;

    currentEditingCustomerId = id;
    const form = document.getElementById('form-customer');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    document.getElementById('modal-customer-title').textContent = `編輯客戶資料 (${id})`;
    document.getElementById('customer-input-id').value = customer.customerId;
    document.getElementById('customer-input-companyName').value = customer.companyName || '';
    document.getElementById('customer-input-contactPerson').value = customer.contactPerson || '';
    document.getElementById('customer-input-englishName').value = customer.englishName || '';
    document.getElementById('customer-input-department').value = customer.department || '';
    document.getElementById('customer-input-jobTitle').value = customer.jobTitle || '';
    document.getElementById('customer-input-phone').value = customer.phone || '';
    document.getElementById('customer-input-email').value = customer.email || '';
    document.getElementById('customer-input-taxId').value = customer.taxId || '';
    document.getElementById('customer-input-address').value = customer.address || '';
    document.getElementById('customer-input-paymentTerms').value = customer.paymentTerms || '';
    document.getElementById('customer-input-notes').value = customer.notes || '';

    const modalEl = document.getElementById('modal-customer');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  /**
   * 處理表單驗證與儲存
   * @param {Event} e 
   */
  handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    // 執行表單驗證 (Phase 7)
    const isValid = validateCustomerForm(form);
    if (!isValid) {
      e.stopPropagation();
      return;
    }

    const customerData = {
      customerId: document.getElementById('customer-input-id').value.trim(),
      companyName: document.getElementById('customer-input-companyName').value.trim(),
      contactPerson: document.getElementById('customer-input-contactPerson').value.trim(),
      englishName: document.getElementById('customer-input-englishName').value.trim(),
      department: document.getElementById('customer-input-department').value.trim(),
      jobTitle: document.getElementById('customer-input-jobTitle').value.trim(),
      phone: document.getElementById('customer-input-phone').value.trim(),
      email: document.getElementById('customer-input-email').value.trim(),
      taxId: document.getElementById('customer-input-taxId').value.trim(),
      address: document.getElementById('customer-input-address').value.trim(),
      paymentTerms: document.getElementById('customer-input-paymentTerms').value.trim(),
      notes: document.getElementById('customer-input-notes').value.trim()
    };

    let customers = StorageService.getCustomers();

    if (currentEditingCustomerId) {
      // 編輯更新
      const index = customers.findIndex(c => c.customerId === currentEditingCustomerId);
      if (index !== -1) {
        customers[index] = customerData;
        showToast('客戶資料更新成功', 'success');
      }
    } else {
      // 新增確認 ID 唯一
      if (customers.some(c => c.customerId === customerData.customerId)) {
        showToast('客戶代碼已存在，請重新產生', 'danger');
        return;
      }
      customers.unshift(customerData);
      showToast('客戶資料新增成功', 'success');
    }

    StorageService.saveCustomers(customers);
    this.renderList();

    // 關閉 Modal
    const modalEl = document.getElementById('modal-customer');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // 觸發外部事件以通知 Dashboard 更新統計
    window.dispatchEvent(new CustomEvent('data-updated'));
  },

  /**
   * 查看客戶詳細資料
   * @param {string} id 
   */
  viewDetail(id) {
    const customer = StorageService.findCustomerById(id);
    if (!customer) return;

    document.getElementById('view-cust-id').textContent = customer.customerId;
    document.getElementById('view-cust-companyName').textContent = customer.companyName;
    document.getElementById('view-cust-englishName').textContent = customer.englishName || '無';
    document.getElementById('view-cust-contactPerson').textContent = customer.contactPerson;
    document.getElementById('view-cust-department').textContent = customer.department;
    document.getElementById('view-cust-jobTitle').textContent = customer.jobTitle || '無';
    document.getElementById('view-cust-phone').textContent = customer.phone;
    document.getElementById('view-cust-email').textContent = customer.email;
    document.getElementById('view-cust-taxId').textContent = customer.taxId;
    document.getElementById('view-cust-address').textContent = customer.address;
    document.getElementById('view-cust-paymentTerms').textContent = customer.paymentTerms || '無指定';
    document.getElementById('view-cust-notes').textContent = customer.notes || '無備註';

    const modalEl = document.getElementById('modal-view-customer');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  /**
   * 準備刪除客戶 (彈出確認 Modal)
   * @param {string} id 
   */
  promptDelete(id) {
    const customer = StorageService.findCustomerById(id);
    if (!customer) return;

    currentDeleteCustomerId = id;
    document.getElementById('delete-customer-target-name').textContent = `${customer.companyName} (${customer.customerId})`;
    
    // 檢查是否有關聯的報價單
    const quotes = StorageService.getQuotes();
    const relatedQuotes = quotes.filter(q => q.customerId === id);
    const warningEl = document.getElementById('delete-customer-warning');
    if (relatedQuotes.length > 0) {
      warningEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> 注意：此客戶已有 <strong>${relatedQuotes.length}</strong> 張相關報價單，刪除後關聯單據仍會保留客戶代碼。`;
      warningEl.classList.remove('d-none');
    } else {
      warningEl.classList.add('d-none');
    }

    const modalEl = document.getElementById('modal-delete-customer');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  /**
   * 執行刪除客戶
   */
  executeDelete() {
    if (!currentDeleteCustomerId) return;
    StorageService.deleteCustomer(currentDeleteCustomerId);

    showToast(`客戶代碼 ${currentDeleteCustomerId} 已安全刪除`, 'info');
    currentDeleteCustomerId = null;

    const modalEl = document.getElementById('modal-delete-customer');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    this.renderList();
    window.dispatchEvent(new CustomEvent('data-updated'));
  }
};

/**
 * 客戶表單驗證規則 (Phase 7)
 */
function validateCustomerForm(form) {
  let isValid = true;
  clearCustomErrors(form);

  const requiredFields = [
    { id: 'customer-input-companyName', name: '公司名稱' },
    { id: 'customer-input-contactPerson', name: '聯絡窗口' },
    { id: 'customer-input-department', name: '部門' },
    { id: 'customer-input-phone', name: '電話' },
    { id: 'customer-input-email', name: 'Email' },
    { id: 'customer-input-taxId', name: '統一編號' },
    { id: 'customer-input-address', name: '地址' }
  ];

  // 1. 必填驗證
  requiredFields.forEach(field => {
    const el = document.getElementById(field.id);
    if (!el || !el.value.trim()) {
      setFieldError(el, `請填寫${field.name}`);
      isValid = false;
    }
  });

  // 2. Email 格式驗證
  const emailEl = document.getElementById('customer-input-email');
  if (emailEl && emailEl.value.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailEl.value.trim())) {
      setFieldError(emailEl, '請輸入正確有效的 Email 格式 (例如 name@domain.com)');
      isValid = false;
    }
  }

  // 3. 統一編號 8 位數字驗證
  const taxIdEl = document.getElementById('customer-input-taxId');
  if (taxIdEl && taxIdEl.value.trim()) {
    const taxRegex = /^[0-9]{8}$/;
    if (!taxRegex.test(taxIdEl.value.trim())) {
      setFieldError(taxIdEl, '統一編號須為 8 碼半形數字');
      isValid = false;
    }
  }

  // 4. 電話基本格式驗證 (允許數字、分機、破折號)
  const phoneEl = document.getElementById('customer-input-phone');
  if (phoneEl && phoneEl.value.trim()) {
    const phoneRegex = /^[\d\-+()#\s]{7,20}$/;
    if (!phoneRegex.test(phoneEl.value.trim())) {
      setFieldError(phoneEl, '請輸入有效之電話號碼格式 (例如 02-25008899)');
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
  form.querySelectorAll('.invalid-feedback').forEach(el => {
    // 保留 HTML 預設結構，僅清除動態文字
  });
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
