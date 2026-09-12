/**
 * 報價單管理系統 - 核心整合協調器 (Phase 1 ~ Phase 9)
 * 職責：
 * 1. 初始化 LocalStorage 資料層與各模組 (Customers, Vendors, Products, Quotes)
 * 2. 路由與視圖切換 (Hash Routing: #dashboard, #customers, #vendors, #products, #quotes)
 * 3. 即時統計 Dashboard 數據與最新報價單動態列表
 * 4. 全域 Toast 訊息通知機制 (替換傳統 alert())
 * 5. 響應式 Offcanvas 抽屜狀態同步
 */

import * as bootstrap from 'bootstrap';
window.bootstrap = bootstrap;
globalThis.bootstrap = bootstrap;

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../css/style.css';

import { StorageService } from './storage.js';
import { CustomersModule } from './customers.js';
import { VendorsModule } from './vendors.js';
import { ProductsModule } from './products.js';
import { QuotesModule } from './quotes.js';

const VIEW_CONFIG = {
  dashboard: { title: '系統總覽 (Dashboard)', breadcrumb: 'Dashboard' },
  customers: { title: '客戶管理', breadcrumb: '客戶管理' },
  vendors: { title: '廠商管理', breadcrumb: '廠商管理' },
  products: { title: '產品管理', breadcrumb: '產品管理' },
  quotes: { title: '報價單管理', breadcrumb: '報價單管理' }
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化資料存取層
  StorageService.init();

  // 2. 初始化全域 Toast
  initToastNotification();

  // 3. 初始化各模組
  CustomersModule.init();
  VendorsModule.init();
  ProductsModule.init();
  QuotesModule.init();

  // 4. 初始化導覽與 Dashboard
  initNavigation();
  refreshDashboard();
  initSystemTime();

  // 5. 監聽全域資料變更事件，動態刷新 Dashboard
  window.addEventListener('data-updated', () => {
    refreshDashboard();
  });
});

/**
 * 導覽切換與路由監聽
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('[data-view]');
  navLinks.forEach(link => {
    link.addEventListener('click', handleNavClick);
  });

  window.addEventListener('hashchange', handleHashChange);

  const initialView = getActiveViewFromHash();
  switchView(initialView);
}

function handleNavClick(event) {
  event.preventDefault();
  const target = event.currentTarget;
  const viewName = target.getAttribute('data-view');

  if (viewName && VIEW_CONFIG[viewName]) {
    window.location.hash = `#${viewName}`;
  }
  closeOffcanvasIfOpen();
}

function handleHashChange() {
  const currentView = getActiveViewFromHash();
  switchView(currentView);
}

function getActiveViewFromHash() {
  const hash = window.location.hash.replace('#', '').trim();
  return VIEW_CONFIG[hash] ? hash : 'dashboard';
}

function switchView(viewName) {
  const safeView = VIEW_CONFIG[viewName] ? viewName : 'dashboard';

  // 切換 View Section
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(section => {
    if (section.id === `view-${safeView}`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // 更新導覽連結 Active 狀態
  const allNavLinks = document.querySelectorAll('[data-view]');
  allNavLinks.forEach(link => {
    if (link.getAttribute('data-view') === safeView) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });

  // 更新動態麵包屑
  const breadcrumbElement = document.getElementById('breadcrumb-current-page');
  if (breadcrumbElement) {
    breadcrumbElement.textContent = VIEW_CONFIG[safeView].breadcrumb;
  }

  // 若切換到 Dashboard，更新統計與最新清單
  if (safeView === 'dashboard') {
    refreshDashboard();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeOffcanvasIfOpen() {
  const offcanvasEl = document.getElementById('sidebarOffcanvas');
  if (offcanvasEl && window.bootstrap && window.bootstrap.Offcanvas) {
    const instance = window.bootstrap.Offcanvas.getInstance(offcanvasEl);
    if (instance) {
      instance.hide();
    }
  }
}

/**
 * 更新 Dashboard 統計數字與最新報價單快速摘要
 */
function refreshDashboard() {
  const customers = StorageService.getCustomers();
  const vendors = StorageService.getVendors();
  const products = StorageService.getProducts();
  const quotes = StorageService.getQuotes();

  updateElementText('stat-customers-count', customers.length);
  updateElementText('stat-vendors-count', vendors.length);
  updateElementText('stat-products-count', products.length);
  updateElementText('stat-quotes-count', quotes.length);

  // 渲染 Dashboard 最新 3 筆報價單
  renderRecentQuotes(quotes);
}

function renderRecentQuotes(quotes) {
  const tbody = document.getElementById('dashboard-recent-quotes-tbody');
  const emptyHint = document.getElementById('dashboard-recent-quotes-empty');
  if (!tbody) return;

  tbody.innerHTML = '';
  const recent = quotes.slice(0, 5);

  if (recent.length === 0) {
    if (emptyHint) emptyHint.classList.remove('d-none');
    return;
  }
  if (emptyHint) emptyHint.classList.add('d-none');

  recent.forEach(quote => {
    const customer = StorageService.findCustomerById(quote.customerId);
    const customerName = customer ? customer.companyName : (quote.customerId || '未知');
    const tr = document.createElement('tr');
    tr.className = 'align-middle';
    tr.innerHTML = `
      <td class="font-monospace fw-bold text-primary">${quote.quoteId}</td>
      <td class="fw-semibold text-dark">${escapeHtml(customerName)}</td>
      <td class="small text-muted">${escapeHtml(quote.quoteDate || '--')}</td>
      <td class="text-end font-monospace fw-bold text-success">$${Number(quote.totalAmount || 0).toLocaleString('zh-TW')}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-light border btn-dash-view-quote" data-id="${quote.quoteId}">
          <i class="bi bi-eye text-primary"></i>
        </button>
      </td>
    `;
    tr.querySelector('.btn-dash-view-quote').addEventListener('click', () => {
      QuotesModule.viewDetail(quote.quoteId);
    });
    tbody.appendChild(tr);
  });
}

function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function initSystemTime() {
  const dateEl = document.getElementById('header-current-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
}

/**
 * 全域 Toast 通知機制 (替代原生 alert())
 */
function initToastNotification() {
  window.showAppToast = function(message, type = 'info') {
    const container = document.getElementById('app-toast-container');
    if (!container) return;

    const bgClass = {
      success: 'bg-success text-white',
      danger: 'bg-danger text-white',
      warning: 'bg-warning text-dark',
      info: 'bg-primary text-white'
    }[type] || 'bg-dark text-white';

    const iconClass = {
      success: 'bi-check-circle-fill',
      danger: 'bi-x-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    }[type] || 'bi-bell-fill';

    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center ${bgClass} border-0 shadow-sm mb-2`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="bi ${iconClass} fs-5"></i>
          <div>${escapeHtml(message)}</div>
        </div>
        <button type="button" class="btn-close ${type === 'warning' ? '' : 'btn-close-white'} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    container.appendChild(toastEl);
    const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => {
      toastEl.remove();
    });
  };
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
