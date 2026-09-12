/**
 * 報價單管理系統 - 廠商管理模組 (Phase 3 & Phase 7 & Phase 8)
 * 職責：
 * 1. 廠商列表渲染 (Table & RWD) 與搜尋過濾
 * 2. 新增廠商 (自動產生 V001~ 代碼)
 * 3. 編輯廠商
 * 4. 查看廠商詳細資訊 (Modal)
 * 5. 刪除廠商 (防呆確認 Modal & 關聯產品提醒)
 * 6. 表單驗證 (所有 * 必填、統編 8 位、Email、電話格式驗證)
 */

import { StorageService } from './storage.js';

let currentEditingVendorId = null;
let currentDeleteVendorId = null;

export const VendorsModule = {
  init() {
    this.bindEvents();
    this.renderList();
  },

  bindEvents() {
    const btnAdd = document.getElementById('btn-add-vendor');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddModal());
    }

    const vendorForm = document.getElementById('form-vendor');
    if (vendorForm) {
      vendorForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    const searchInput = document.getElementById('input-search-vendors');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    const btnConfirmDelete = document.getElementById('btn-confirm-delete-vendor');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => this.executeDelete());
    }
  },

  renderList(listOptional = null) {
    const list = listOptional !== null ? listOptional : StorageService.getVendors();
    const tbody = document.getElementById('table-vendors-body');
    const emptyState = document.getElementById('vendors-empty-state');
    const tableContainer = document.getElementById('vendors-table-container');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
      if (emptyState) emptyState.classList.remove('d-none');
      if (tableContainer) tableContainer.classList.add('d-none');
      return;
    }

    if (emptyState) emptyState.classList.add('d-none');
    if (tableContainer) tableContainer.classList.remove('d-none');

    list.forEach(vendor => {
      const tr = document.createElement('tr');
      tr.className = 'align-middle';
      tr.innerHTML = `
        <td class="fw-bold text-success font-monospace">${vendor.vendorId}</td>
        <td>
          <div class="fw-semibold text-dark">${escapeHtml(vendor.companyName)}</div>
          <div class="small text-muted">${vendor.englishName ? escapeHtml(vendor.englishName) : '統編：' + escapeHtml(vendor.taxId)}</div>
        </td>
        <td>
          <div>${escapeHtml(vendor.contactPerson)}</div>
          <span class="badge bg-light text-secondary border">${escapeHtml(vendor.department)} / ${escapeHtml(vendor.jobTitle || '無')}</span>
        </td>
        <td>
          <div class="small text-dark"><i class="bi bi-telephone text-muted me-1"></i>${escapeHtml(vendor.phone)}</div>
          <div class="small text-muted"><i class="bi bi-envelope text-muted me-1"></i>${escapeHtml(vendor.email)}</div>
        </td>
        <td class="d-none d-md-table-cell">
          <span class="badge bg-success-subtle text-success">${escapeHtml(vendor.paymentTerms || '一般條款')}</span>
        </td>
        <td class="text-end text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-info me-1 btn-view-vendor" data-id="${vendor.vendorId}" title="查看詳細">
            <i class="bi bi-eye"></i><span class="d-none d-sm-inline ms-1">查看</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-success me-1 btn-edit-vendor" data-id="${vendor.vendorId}" title="編輯">
            <i class="bi bi-pencil-square"></i><span class="d-none d-sm-inline ms-1">編輯</span>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete-vendor" data-id="${vendor.vendorId}" title="刪除">
            <i class="bi bi-trash3"></i><span class="d-none d-sm-inline ms-1">刪除</span>
          </button>
        </td>
      `;

      tr.querySelector('.btn-view-vendor').addEventListener('click', () => this.viewDetail(vendor.vendorId));
      tr.querySelector('.btn-edit-vendor').addEventListener('click', () => this.openEditModal(vendor.vendorId));
      tr.querySelector('.btn-delete-vendor').addEventListener('click', () => this.promptDelete(vendor.vendorId));

      tbody.appendChild(tr);
    });
  },

  handleSearch(query) {
    const term = query.trim().toLowerCase();
    const vendors = StorageService.getVendors();
    if (!term) {
      this.renderList(vendors);
      return;
    }
    const filtered = vendors.filter(v => 
      v.vendorId.toLowerCase().includes(term) ||
      v.companyName.toLowerCase().includes(term) ||
      v.contactPerson.toLowerCase().includes(term) ||
      v.taxId.includes(term) ||
      v.phone.includes(term) ||
      v.email.toLowerCase().includes(term)
    );
    this.renderList(filtered);
  },

  openAddModal() {
    currentEditingVendorId = null;
    const form = document.getElementById('form-vendor');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    const nextId = StorageService.generateNextId('vendor');
    const idInput = document.getElementById('vendor-input-id');
    if (idInput) idInput.value = nextId;

    document.getElementById('modal-vendor-title').textContent = '新增廠商資料';
    const modalEl = document.getElementById('modal-vendor');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  openEditModal(id) {
    const vendor = StorageService.findVendorById(id);
    if (!vendor) return;

    currentEditingVendorId = id;
    const form = document.getElementById('form-vendor');
    if (!form) return;
    form.reset();
    form.classList.remove('was-validated');
    clearCustomErrors(form);

    document.getElementById('modal-vendor-title').textContent = `編輯廠商資料 (${id})`;
    document.getElementById('vendor-input-id').value = vendor.vendorId;
    document.getElementById('vendor-input-companyName').value = vendor.companyName || '';
    document.getElementById('vendor-input-contactPerson').value = vendor.contactPerson || '';
    document.getElementById('vendor-input-englishName').value = vendor.englishName || '';
    document.getElementById('vendor-input-department').value = vendor.department || '';
    document.getElementById('vendor-input-jobTitle').value = vendor.jobTitle || '';
    document.getElementById('vendor-input-phone').value = vendor.phone || '';
    document.getElementById('vendor-input-email').value = vendor.email || '';
    document.getElementById('vendor-input-taxId').value = vendor.taxId || '';
    document.getElementById('vendor-input-address').value = vendor.address || '';
    document.getElementById('vendor-input-paymentTerms').value = vendor.paymentTerms || '';
    document.getElementById('vendor-input-notes').value = vendor.notes || '';

    const modalEl = document.getElementById('modal-vendor');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    
    const isValid = validateVendorForm(form);
    if (!isValid) {
      e.stopPropagation();
      return;
    }

    const vendorData = {
      vendorId: document.getElementById('vendor-input-id').value.trim(),
      companyName: document.getElementById('vendor-input-companyName').value.trim(),
      contactPerson: document.getElementById('vendor-input-contactPerson').value.trim(),
      englishName: document.getElementById('vendor-input-englishName').value.trim(),
      department: document.getElementById('vendor-input-department').value.trim(),
      jobTitle: document.getElementById('vendor-input-jobTitle').value.trim(),
      phone: document.getElementById('vendor-input-phone').value.trim(),
      email: document.getElementById('vendor-input-email').value.trim(),
      taxId: document.getElementById('vendor-input-taxId').value.trim(),
      address: document.getElementById('vendor-input-address').value.trim(),
      paymentTerms: document.getElementById('vendor-input-paymentTerms').value.trim(),
      notes: document.getElementById('vendor-input-notes').value.trim()
    };

    let vendors = StorageService.getVendors();

    if (currentEditingVendorId) {
      const index = vendors.findIndex(v => v.vendorId === currentEditingVendorId);
      if (index !== -1) {
        vendors[index] = vendorData;
        showToast('廠商資料更新成功', 'success');
      }
    } else {
      if (vendors.some(v => v.vendorId === vendorData.vendorId)) {
        showToast('廠商代碼已存在，請重新產生', 'danger');
        return;
      }
      vendors.unshift(vendorData);
      showToast('廠商資料新增成功', 'success');
    }

    StorageService.saveVendors(vendors);
    this.renderList();

    const modalEl = document.getElementById('modal-vendor');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // 通知外部更新 (包含產品管理供應商下拉選單與 Dashboard 統計)
    window.dispatchEvent(new CustomEvent('vendors-updated'));
    window.dispatchEvent(new CustomEvent('data-updated'));
  },

  viewDetail(id) {
    const vendor = StorageService.findVendorById(id);
    if (!vendor) return;

    document.getElementById('view-vend-id').textContent = vendor.vendorId;
    document.getElementById('view-vend-companyName').textContent = vendor.companyName;
    document.getElementById('view-vend-englishName').textContent = vendor.englishName || '無';
    document.getElementById('view-vend-contactPerson').textContent = vendor.contactPerson;
    document.getElementById('view-vend-department').textContent = vendor.department;
    document.getElementById('view-vend-jobTitle').textContent = vendor.jobTitle || '無';
    document.getElementById('view-vend-phone').textContent = vendor.phone;
    document.getElementById('view-vend-email').textContent = vendor.email;
    document.getElementById('view-vend-taxId').textContent = vendor.taxId;
    document.getElementById('view-vend-address').textContent = vendor.address;
    document.getElementById('view-vend-paymentTerms').textContent = vendor.paymentTerms || '無指定';
    document.getElementById('view-vend-notes').textContent = vendor.notes || '無備註';

    const modalEl = document.getElementById('modal-view-vendor');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  promptDelete(id) {
    const vendor = StorageService.findVendorById(id);
    if (!vendor) return;

    currentDeleteVendorId = id;
    document.getElementById('delete-vendor-target-name').textContent = `${vendor.companyName} (${vendor.vendorId})`;
    
    // 檢查是否有關聯產品
    const products = StorageService.getProducts();
    const relatedProducts = products.filter(p => p.vendorId === id);
    const warningEl = document.getElementById('delete-vendor-warning');
    if (relatedProducts.length > 0) {
      warningEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill text-warning me-1"></i> 注意：目前有 <strong>${relatedProducts.length}</strong> 個產品由該廠商供貨，刪除廠商後相關產品會顯示「未知廠商」。`;
      warningEl.classList.remove('d-none');
    } else {
      warningEl.classList.add('d-none');
    }

    const modalEl = document.getElementById('modal-delete-vendor');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  },

  executeDelete() {
    if (!currentDeleteVendorId) return;
    let vendors = StorageService.getVendors();
    vendors = vendors.filter(v => v.vendorId !== currentDeleteVendorId);
    StorageService.saveVendors(vendors);

    showToast(`廠商代碼 ${currentDeleteVendorId} 已安全刪除`, 'info');
    currentDeleteVendorId = null;

    const modalEl = document.getElementById('modal-delete-vendor');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    this.renderList();
    window.dispatchEvent(new CustomEvent('vendors-updated'));
    window.dispatchEvent(new CustomEvent('data-updated'));
  }
};

function validateVendorForm(form) {
  let isValid = true;
  clearCustomErrors(form);

  const requiredFields = [
    { id: 'vendor-input-companyName', name: '公司名稱' },
    { id: 'vendor-input-contactPerson', name: '聯絡窗口' },
    { id: 'vendor-input-department', name: '部門' },
    { id: 'vendor-input-phone', name: '電話' },
    { id: 'vendor-input-email', name: 'Email' },
    { id: 'vendor-input-taxId', name: '統一編號' },
    { id: 'vendor-input-address', name: '地址' }
  ];

  requiredFields.forEach(field => {
    const el = document.getElementById(field.id);
    if (!el || !el.value.trim()) {
      setFieldError(el, `請填寫${field.name}`);
      isValid = false;
    }
  });

  const emailEl = document.getElementById('vendor-input-email');
  if (emailEl && emailEl.value.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailEl.value.trim())) {
      setFieldError(emailEl, '請輸入正確有效的 Email 格式');
      isValid = false;
    }
  }

  const taxIdEl = document.getElementById('vendor-input-taxId');
  if (taxIdEl && taxIdEl.value.trim()) {
    const taxRegex = /^[0-9]{8}$/;
    if (!taxRegex.test(taxIdEl.value.trim())) {
      setFieldError(taxIdEl, '統一編號須為 8 碼半形數字');
      isValid = false;
    }
  }

  const phoneEl = document.getElementById('vendor-input-phone');
  if (phoneEl && phoneEl.value.trim()) {
    const phoneRegex = /^[\d\-+()#\s]{7,20}$/;
    if (!phoneRegex.test(phoneEl.value.trim())) {
      setFieldError(phoneEl, '請輸入有效之電話號碼格式');
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
