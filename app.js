// ============================================================
// روشتة — نظام إدارة الصيدلية (JavaScript كامل)
// مع Firebase Realtime Database لتخزين جميع البيانات
// ============================================================

// -------------------- استيراد Firebase --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  push, 
  remove, 
  onValue,
  update,
  child
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// -------------------- إعداد Firebase --------------------
const firebaseConfig = {
  apiKey: "AIzaSyBBCEYQgQB_ZbKgnz_uv6u21f9G66Lxq5E",
  authDomain: "mtajr-43ece.firebaseapp.com",
  databaseURL: "https://mtajr-43ece-default-rtdb.firebaseio.com",
  projectId: "mtajr-43ece",
  storageBucket: "mtajr-43ece.firebasestorage.app",
  messagingSenderId: "770090767011",
  appId: "1:770090767011:web:528019019ff7cf0d032516",
  measurementId: "G-1YVMN9YNTS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// -------------------- الحالة العامة للتطبيق --------------------
const STATE = {
  currentUser: null,
  currentRole: 'user',
  drugs: [],
  sales: [],
  customers: [],
  employees: [],
  settings: {
    pharmacyName: 'روشتة',
    currency: 'ر.س',
    lowStockThreshold: 10,
    expiryWarningDays: 30
  },
  cart: [],
  editingDrugId: null,
  editingCustomerId: null,
  editingEmployeeId: null,
  isLoggedIn: false,
  isSyncing: false,
  syncQueue: []
};

// -------------------- مراجع DOM --------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// شاشة تسجيل الدخول
const loginScreen = $('#loginScreen');
const loginForm = $('#loginForm');
const loginEmail = $('#loginEmail');
const loginPassword = $('#loginPassword');
const loginError = $('#loginError');
const loginSubmitBtn = $('#loginSubmitBtn');
const togglePassword = $('#togglePassword');
const eyeIcon = $('#eyeIcon');

// هيكل التطبيق
const appShell = $('#appShell');
const sidebar = $('#sidebar');
const sidebarOverlay = $('#sidebarOverlay');
const sidebarCollapseBtn = $('#sidebarCollapseBtn');
const mobileMenuBtn = $('#mobileMenuBtn');
const logoutBtn = $('#logoutBtn');
const pageTitle = $('#pageTitle');
const pharmacyNameDisplay = $('#pharmacyNameDisplay');
const userNameDisplay = $('#userNameDisplay');
const userRoleDisplay = $('#userRoleDisplay');
const userAvatarInitial = $('#userAvatarInitial');
const alertsBtn = $('#alertsBtn');
const alertsBadge = $('#alertsBadge');
const alertsDropdown = $('#alertsDropdown');
const alertsDropdownList = $('#alertsDropdownList');
const dashGreetingName = $('#dashGreetingName');
const dashToday = $('#dashToday');
const toastContainer = $('#toastContainer');
const printArea = $('#printArea');

// -------------------- دوال مساعدة --------------------
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatCurrency(amount) {
  return `${Number(amount).toFixed(2)} ${STATE.settings.currency}`;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentDateISO() {
  return new Date().toISOString();
}

// -------------------- دوال Firebase Database --------------------

// حفظ جميع البيانات إلى Firebase
async function saveAllDataToFirebase() {
  if (!STATE.currentUser) return;
  
  try {
    const userRef = ref(db, `users/${STATE.currentUser.uid}/data`);
    const data = {
      drugs: STATE.drugs,
      sales: STATE.sales,
      customers: STATE.customers,
      employees: STATE.employees,
      settings: STATE.settings,
      lastUpdated: getCurrentDateISO()
    };
    await set(userRef, data);
    console.log('✅ تم حفظ جميع البيانات في Firebase');
    return true;
  } catch (error) {
    console.error('❌ خطأ في حفظ البيانات:', error);
    showToast('خطأ في حفظ البيانات: ' + error.message, 'error');
    return false;
  }
}

// تحميل جميع البيانات من Firebase
async function loadAllDataFromFirebase() {
  if (!STATE.currentUser) return false;
  
  try {
    const userRef = ref(db, `users/${STATE.currentUser.uid}/data`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      STATE.drugs = data.drugs || [];
      STATE.sales = data.sales || [];
      STATE.customers = data.customers || [];
      STATE.employees = data.employees || [];
      STATE.settings = data.settings || STATE.settings;
      console.log('✅ تم تحميل البيانات من Firebase');
      return true;
    } else {
      // لا توجد بيانات، نقوم بإنشاء بيانات افتراضية
      console.log('📝 لا توجد بيانات، سيتم إنشاء بيانات جديدة');
      await saveAllDataToFirebase();
      return true;
    }
  } catch (error) {
    console.error('❌ خطأ في تحميل البيانات:', error);
    showToast('خطأ في تحميل البيانات: ' + error.message, 'error');
    return false;
  }
}

// الاستماع للتغييرات في الوقت الفعلي
function listenForDataChanges() {
  if (!STATE.currentUser) return;
  
  const userRef = ref(db, `users/${STATE.currentUser.uid}/data`);
  
  onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const oldDrugs = STATE.drugs.length;
      const oldSales = STATE.sales.length;
      
      STATE.drugs = data.drugs || [];
      STATE.sales = data.sales || [];
      STATE.customers = data.customers || [];
      STATE.employees = data.employees || [];
      STATE.settings = data.settings || STATE.settings;
      
      // تحديث الواجهة إذا تغيرت البيانات
      if (oldDrugs !== STATE.drugs.length || oldSales !== STATE.sales.length) {
        console.log('🔄 تم تحديث البيانات من السحاب');
        refreshAllViews();
      }
    }
  }, (error) => {
    console.error('❌ خطأ في الاستماع للبيانات:', error);
  });
}

// وظيفة لتحديث جميع الصفحات
function refreshAllViews() {
  // تحديث لوحة التحكم
  updateKPIs();
  updateDashboardAlerts();
  updateRecentSales();
  
  // تحديث الصفحات
  renderInventoryTable();
  renderCustomersTable();
  renderEmployeesTable();
  renderSalesHistory();
  renderCart();
  updateSettingsForm();
  updateAlertsBadge();
  updateEmployeeSelects();
  
  // تحديث الرسوم البيانية
  setTimeout(() => {
    updateSalesChart();
  }, 300);
}

// -------------------- دالة حفظ البيانات المعدلة --------------------
async function saveData() {
  // حفظ فوري في Firebase
  await saveAllDataToFirebase();
}

// -------------------- الإشعارات (Toast) --------------------
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '';
  if (type === 'success') icon = '✅';
  else if (type === 'error') icon = '❌';
  else icon = 'ℹ️';
  
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// -------------------- النوافذ المنبثقة (Modal) --------------------
function openModal(title, bodyHTML, footerHTML = '') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="modal-close" data-close-modal>✕</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-foot">${footerHTML}</div>` : ''}
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  overlay.querySelector('[data-close-modal]').addEventListener('click', () => {
    overlay.remove();
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  return overlay;
}

// -------------------- المصادقة (Firebase) --------------------
async function loginUser(email, password) {
  try {
    loginSubmitBtn.disabled = true;
    loginSubmitBtn.querySelector('.btn-label').classList.add('hidden');
    loginSubmitBtn.querySelector('.btn-spinner').classList.remove('hidden');
    loginError.classList.add('hidden');
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // تحديد الدور من البريد الإلكتروني
    let role = 'user';
    let name = email.split('@')[0];
    
    if (email.includes('admin') || email.startsWith('admin')) {
      role = 'admin';
    }
    
    STATE.currentUser = {
      uid: user.uid,
      email: email,
      role: role,
      name: name
    };
    STATE.currentRole = role;
    STATE.isLoggedIn = true;
    
    // حفظ الجلسة
    sessionStorage.setItem('roshita_session', JSON.stringify({
      uid: user.uid,
      email: email,
      role: role,
      name: name
    }));
    
    showToast(`مرحباً ${name}!`, 'success');
    
    // تحميل البيانات من Firebase
    await loadAllDataFromFirebase();
    
    // بدء الاستماع للتغييرات
    listenForDataChanges();
    
    renderApp();
    
  } catch (error) {
    console.error('خطأ في تسجيل الدخول:', error);
    loginError.textContent = error.message === 'Firebase: Error (auth/invalid-credential).' 
      ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      : error.message;
    loginError.classList.remove('hidden');
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.querySelector('.btn-label').classList.remove('hidden');
    loginSubmitBtn.querySelector('.btn-spinner').classList.add('hidden');
  }
}

async function logoutUser() {
  try {
    await signOut(auth);
    STATE.isLoggedIn = false;
    STATE.currentUser = null;
    STATE.currentRole = 'user';
    sessionStorage.removeItem('roshita_session');
    showToast('تم تسجيل الخروج', 'info');
    showLoginScreen();
  } catch (error) {
    console.error('خطأ في تسجيل الخروج:', error);
    showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
  }
}

// التحقق من حالة المصادقة
function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const session = sessionStorage.getItem('roshita_session');
      if (session) {
        try {
          const data = JSON.parse(session);
          STATE.currentUser = {
            uid: user.uid,
            email: data.email || user.email,
            role: data.role || 'user',
            name: data.name || (data.email || user.email).split('@')[0]
          };
          STATE.currentRole = STATE.currentUser.role;
          STATE.isLoggedIn = true;
          
          // تحميل البيانات من Firebase
          await loadAllDataFromFirebase();
          listenForDataChanges();
          renderApp();
          return;
        } catch (e) {}
      }
      
      showLoginScreen();
    } else {
      showLoginScreen();
    }
  });
}

// -------------------- عرض شاشة تسجيل الدخول --------------------
function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  appShell.classList.add('hidden');
  loginEmail.value = '';
  loginPassword.value = '';
  loginError.classList.add('hidden');
}

// -------------------- عرض التطبيق --------------------
function renderApp() {
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  
  const user = STATE.currentUser;
  if (user) {
    pharmacyNameDisplay.textContent = STATE.settings.pharmacyName || 'روشتة';
    userNameDisplay.textContent = user.name || 'صيدلاني';
    userRoleDisplay.textContent = user.role === 'admin' ? 'مدير' : 'صيدلاني';
    userAvatarInitial.textContent = (user.name || 'ص').charAt(0);
    dashGreetingName.textContent = user.name || 'صيدلاني';
  }
  
  if (STATE.currentRole === 'admin') {
    document.body.classList.add('role-admin');
  } else {
    document.body.classList.remove('role-admin');
  }
  
  dashToday.textContent = formatDate(new Date());
  
  showView('dashboard');
  refreshAllViews();
}

// -------------------- باقي الدوال (نفس الكود السابق مع تعديل حفظ البيانات) --------------------

// ... [جميع الدوال السابقة مع تغيير حفظ البيانات إلى saveData()]

// -------------------- التنقل بين الصفحات --------------------
function showView(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  
  const target = $(`#view-${viewId}`);
  if (target) {
    target.classList.add('active');
  }
  
  $$('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewId);
  });
  
  const titles = {
    dashboard: 'الرئيسية',
    inventory: 'إدارة الأدوية',
    pos: 'المبيعات',
    customers: 'العملاء',
    reports: 'التقارير',
    employees: 'الموظفون والصلاحيات',
    settings: 'الإعدادات والنسخ الاحتياطي'
  };
  pageTitle.textContent = titles[viewId] || viewId;
  
  if (viewId === 'reports') {
    setTimeout(() => {
      updateReportCharts();
    }, 300);
  }
  
  if (viewId === 'pos') {
    renderCart();
  }
}

// ============================================================
// جميع الدوال التالية بنفس الكود السابق
// ولكن مع استبدال localStorage بـ Firebase
// ============================================================

// -------------------- لوحة التحكم (Dashboard) --------------------
function updateKPIs() {
  const strip = $('#kpiStrip');
  const totalDrugs = STATE.drugs.length;
  const totalSales = STATE.sales.length;
  const totalRevenue = STATE.sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
  const lowStock = STATE.drugs.filter(d => d.quantity <= STATE.settings.lowStockThreshold).length;
  
  const today = getToday();
  const todaySales = STATE.sales.filter(s => s.date && s.date.startsWith(today));
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  
  strip.innerHTML = `
    <div class="kpi-tab accent-primary">
      <div class="kpi-tab-hole2"></div>
      <div class="kpi-label"><span class="dot"></span> الأدوية</div>
      <div class="kpi-value">${totalDrugs}</div>
      <div class="kpi-foot">صنف في المخزون</div>
    </div>
    <div class="kpi-tab accent-clay">
      <div class="kpi-tab-hole2"></div>
      <div class="kpi-label"><span class="dot"></span> مبيعات اليوم</div>
      <div class="kpi-value">${todaySales.length}</div>
      <div class="kpi-foot">${formatCurrency(todayRevenue)}</div>
    </div>
    <div class="kpi-tab accent-primary">
      <div class="kpi-tab-hole2"></div>
      <div class="kpi-label"><span class="dot"></span> إجمالي المبيعات</div>
      <div class="kpi-value">${totalSales}</div>
      <div class="kpi-foot">${formatCurrency(totalRevenue)}</div>
    </div>
    <div class="kpi-tab ${lowStock > 0 ? 'has-alert accent-danger' : 'accent-amber'}">
      <div class="kpi-tab-hole2"></div>
      <div class="kpi-label"><span class="dot"></span> مخزون منخفض</div>
      <div class="kpi-value">${lowStock}</div>
      <div class="kpi-foot">دواء يحتاج إعادة طلب</div>
    </div>
  `;
}

function updateDashboardAlerts() {
  const container = $('#dashboardAlertsList');
  const alerts = getAlerts();
  
  if (alerts.length === 0) {
    container.innerHTML = `<div class="no-alerts">✅ لا توجد تنبيهات حالياً</div>`;
    return;
  }
  
  container.innerHTML = alerts.slice(0, 5).map(alert => `
    <div class="alert-item severity-${alert.severity}">
      <div class="alert-item-icon">
        ${alert.severity === 'danger' ? '⚠️' : '⚡'}
      </div>
      <div class="alert-item-text">
        <strong>${alert.title}</strong>
        <span>${alert.message}</span>
      </div>
    </div>
  `).join('');
}

function getAlerts() {
  const alerts = [];
  const now = new Date();
  const warningDays = STATE.settings.expiryWarningDays || 30;
  
  STATE.drugs.forEach(drug => {
    if (drug.quantity <= 0) {
      alerts.push({
        severity: 'danger',
        title: `نفد المخزون: ${drug.name}`,
        message: `الكمية: ${drug.quantity}`
      });
    } else if (drug.quantity <= STATE.settings.lowStockThreshold) {
      alerts.push({
        severity: 'amber',
        title: `مخزون منخفض: ${drug.name}`,
        message: `الكمية: ${drug.quantity} (الحد الأدنى: ${STATE.settings.lowStockThreshold})`
      });
    }
    
    if (drug.expiryDate) {
      const expiry = new Date(drug.expiryDate);
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        alerts.push({
          severity: 'danger',
          title: `دواء منتهي الصلاحية: ${drug.name}`,
          message: `تاريخ الانتهاء: ${formatDate(drug.expiryDate)}`
        });
      } else if (diffDays <= warningDays) {
        alerts.push({
          severity: 'amber',
          title: `قرب انتهاء الصلاحية: ${drug.name}`,
          message: `ينتهي خلال ${diffDays} يوم (${formatDate(drug.expiryDate)})`
        });
      }
    }
  });
  
  return alerts.sort((a, b) => {
    const order = { danger: 0, amber: 1 };
    return (order[a.severity] || 2) - (order[b.severity] || 2);
  });
}

function updateAlertsBadge() {
  const alerts = getAlerts();
  if (alerts.length > 0) {
    alertsBadge.classList.remove('hidden');
  } else {
    alertsBadge.classList.add('hidden');
  }
}

function updateRecentSales() {
  const tbody = $('#recentSalesBody');
  const empty = $('#recentSalesEmpty');
  const recent = STATE.sales.slice(-5).reverse();
  
  if (recent.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  
  tbody.innerHTML = recent.map(sale => `
    <tr>
      <td class="cell-mono">#${sale.id || 'N/A'}</td>
      <td>${formatDate(sale.date)}</td>
      <td>${sale.customerName || '—'}</td>
      <td>${formatCurrency(sale.total || 0)}</td>
      <td>${sale.cashier || '—'}</td>
    </tr>
  `).join('');
}

// -------------------- إدارة الأدوية --------------------
function renderInventoryTable() {
  const tbody = $('#inventoryTableBody');
  const empty = $('#inventoryEmptyState');
  const search = $('#drugSearchInput').value.toLowerCase().trim();
  const categoryFilter = $('#drugCategoryFilter').value;
  const stockFilter = $('#drugStockFilter').value;
  
  let filtered = STATE.drugs;
  
  if (search) {
    filtered = filtered.filter(d => 
      d.name.toLowerCase().includes(search) || 
      (d.barcode && d.barcode.includes(search)) ||
      (d.category && d.category.toLowerCase().includes(search))
    );
  }
  
  if (categoryFilter) {
    filtered = filtered.filter(d => d.category === categoryFilter);
  }
  
  if (stockFilter === 'low') {
    filtered = filtered.filter(d => d.quantity <= STATE.settings.lowStockThreshold);
  } else if (stockFilter === 'expiring') {
    const now = new Date();
    const days = STATE.settings.expiryWarningDays || 30;
    filtered = filtered.filter(d => {
      if (!d.expiryDate) return false;
      const diff = Math.ceil((new Date(d.expiryDate) - now) / (1000 * 60 * 60 * 24));
      return diff > 0 && diff <= days;
    });
  } else if (stockFilter === 'expired') {
    const now = new Date();
    filtered = filtered.filter(d => {
      if (!d.expiryDate) return false;
      return new Date(d.expiryDate) < now;
    });
  }
  
  const categories = [...new Set(STATE.drugs.map(d => d.category).filter(Boolean))];
  const catSelect = $('#drugCategoryFilter');
  const currentCat = catSelect.value;
  catSelect.innerHTML = '<option value="">كل الفئات</option>' + 
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
  catSelect.value = currentCat;
  
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  
  tbody.innerHTML = filtered.map(drug => {
    const now = new Date();
    let status = 'ok';
    let statusLabel = 'متوفر';
    let statusClass = 'badge-ok';
    
    if (drug.quantity <= 0) {
      status = 'out';
      statusLabel = 'نفد';
      statusClass = 'badge-out';
    } else if (drug.quantity <= STATE.settings.lowStockThreshold) {
      status = 'low';
      statusLabel = 'منخفض';
      statusClass = 'badge-low';
    }
    
    if (drug.expiryDate) {
      const diff = Math.ceil((new Date(drug.expiryDate) - now) / (1000 * 60 * 60 * 24));
      if (diff < 0) {
        status = 'expired';
        statusLabel = 'منتهي';
        statusClass = 'badge-expired';
      } else if (diff <= STATE.settings.expiryWarningDays && status === 'ok') {
        status = 'expiring';
        statusLabel = 'ينتهي قريباً';
        statusClass = 'badge-expiring';
      }
    }
    
    const isAdmin = STATE.currentRole === 'admin';
    
    return `
      <tr>
        <td class="cell-strong">${drug.name}</td>
        <td>${drug.category || '—'}</td>
        <td class="cell-mono">${drug.barcode || '—'}</td>
        <td>${drug.quantity}</td>
        ${isAdmin ? `<td>${formatCurrency(drug.purchasePrice || 0)}</td>` : ''}
        <td>${formatCurrency(drug.salePrice || 0)}</td>
        <td>${drug.expiryDate ? formatDate(drug.expiryDate) : '—'}</td>
        <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-action" data-edit-drug="${drug.id}" title="تعديل">✏️</button>
            ${isAdmin ? `<button class="icon-action danger" data-delete-drug="${drug.id}" title="حذف">🗑️</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  tbody.querySelectorAll('[data-edit-drug]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editDrug;
      openEditDrugModal(id);
    });
  });
  
  tbody.querySelectorAll('[data-delete-drug]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteDrug;
      if (confirm('هل أنت متأكد من حذف هذا الدواء؟')) {
        deleteDrug(id);
      }
    });
  });
}

function openEditDrugModal(id) {
  const drug = id ? STATE.drugs.find(d => d.id === id) : null;
  STATE.editingDrugId = id;
  
  const modal = openModal(id ? 'تعديل دواء' : 'إضافة دواء جديد', `
    <form id="drugForm" class="form-grid">
      <div class="form-field">
        <label>اسم الدواء *</label>
        <input id="drugName" value="${drug ? drug.name : ''}" required>
      </div>
      <div class="form-field">
        <label>الفئة</label>
        <input id="drugCategory" value="${drug ? drug.category || '' : ''}">
      </div>
      <div class="form-field">
        <label>الباركود</label>
        <input id="drugBarcode" value="${drug ? drug.barcode || '' : ''}">
      </div>
      <div class="form-field">
        <label>الكمية *</label>
        <input type="number" id="drugQuantity" value="${drug ? drug.quantity : 0}" min="0" required>
      </div>
      <div class="form-field">
        <label>سعر الشراء</label>
        <input type="number" id="drugPurchasePrice" value="${drug ? drug.purchasePrice || 0 : 0}" step="0.01" min="0">
      </div>
      <div class="form-field">
        <label>سعر البيع *</label>
        <input type="number" id="drugSalePrice" value="${drug ? drug.salePrice || 0 : 0}" step="0.01" min="0" required>
      </div>
      <div class="form-field full">
        <label>تاريخ الانتهاء</label>
        <input type="date" id="drugExpiryDate" value="${drug ? drug.expiryDate || '' : ''}">
      </div>
      <div class="form-field full">
        <label>ملاحظات</label>
        <input id="drugNotes" value="${drug ? drug.notes || '' : ''}">
      </div>
      <button type="submit" class="btn btn-primary">${id ? 'حفظ التعديلات' : 'إضافة دواء'}</button>
    </form>
  `);
  
  const form = modal.querySelector('#drugForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveDrugFromForm(modal);
  });
}

async function saveDrugFromForm(modal) {
  const name = modal.querySelector('#drugName').value.trim();
  const category = modal.querySelector('#drugCategory').value.trim();
  const barcode = modal.querySelector('#drugBarcode').value.trim();
  const quantity = parseInt(modal.querySelector('#drugQuantity').value) || 0;
  const purchasePrice = parseFloat(modal.querySelector('#drugPurchasePrice').value) || 0;
  const salePrice = parseFloat(modal.querySelector('#drugSalePrice').value) || 0;
  const expiryDate = modal.querySelector('#drugExpiryDate').value || null;
  const notes = modal.querySelector('#drugNotes').value.trim();
  
  if (!name) {
    showToast('يرجى إدخال اسم الدواء', 'error');
    return;
  }
  
  if (STATE.editingDrugId) {
    const index = STATE.drugs.findIndex(d => d.id === STATE.editingDrugId);
    if (index !== -1) {
      STATE.drugs[index] = {
        ...STATE.drugs[index],
        name,
        category,
        barcode,
        quantity,
        purchasePrice,
        salePrice,
        expiryDate,
        notes
      };
      showToast('تم تحديث الدواء بنجاح', 'success');
    }
    STATE.editingDrugId = null;
  } else {
    const newDrug = {
      id: generateId(),
      name,
      category,
      barcode,
      quantity,
      purchasePrice,
      salePrice,
      expiryDate,
      notes,
      createdAt: getCurrentDateISO()
    };
    STATE.drugs.push(newDrug);
    showToast('تم إضافة الدواء بنجاح', 'success');
  }
  
  await saveData();
  modal.remove();
  renderInventoryTable();
  updateKPIs();
  updateDashboardAlerts();
  updateAlertsBadge();
  updateEmployeeSelects();
}

async function deleteDrug(id) {
  STATE.drugs = STATE.drugs.filter(d => d.id !== id);
  await saveData();
  renderInventoryTable();
  updateKPIs();
  updateDashboardAlerts();
  updateAlertsBadge();
  updateEmployeeSelects();
  showToast('تم حذف الدواء', 'info');
}

// -------------------- المبيعات (POS) --------------------
function renderCart() {
  const list = $('#cartItemsList');
  const empty = $('#cartEmptyState');
  const count = $('#cartItemsCount');
  const total = $('#cartTotal');
  const checkoutBtn = $('#checkoutBtn');
  
  if (STATE.cart.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    count.textContent = '0';
    total.textContent = '0.00';
    checkoutBtn.disabled = true;
    return;
  }
  empty.classList.add('hidden');
  
  list.innerHTML = STATE.cart.map((item, index) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <strong>${item.name}</strong>
        <span>${formatCurrency(item.price)} × ${item.quantity}</span>
      </div>
      <div class="qty-stepper">
        <button data-cart-decrease="${index}">−</button>
        <span>${item.quantity}</span>
        <button data-cart-increase="${index}">+</button>
      </div>
      <button class="cart-item-remove" data-cart-remove="${index}">
        <svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
  `).join('');
  
  const totalAmount = STATE.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = STATE.cart.reduce((sum, item) => sum + item.quantity, 0);
  count.textContent = totalItems;
  total.textContent = totalAmount.toFixed(2);
  checkoutBtn.disabled = false;
  
  list.querySelectorAll('[data-cart-increase]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.cartIncrease);
      STATE.cart[idx].quantity += 1;
      renderCart();
    });
  });
  
  list.querySelectorAll('[data-cart-decrease]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.cartDecrease);
      if (STATE.cart[idx].quantity > 1) {
        STATE.cart[idx].quantity -= 1;
      } else {
        STATE.cart.splice(idx, 1);
      }
      renderCart();
    });
  });
  
  list.querySelectorAll('[data-cart-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.cartRemove);
      STATE.cart.splice(idx, 1);
      renderCart();
    });
  });
}

function addToCart(drugId) {
  const drug = STATE.drugs.find(d => d.id === drugId);
  if (!drug) return;
  
  if (drug.quantity <= 0) {
    showToast('هذا الدواء غير متوفر حالياً', 'error');
    return;
  }
  
  const existing = STATE.cart.find(item => item.drugId === drugId);
  if (existing) {
    existing.quantity += 1;
  } else {
    STATE.cart.push({
      drugId: drug.id,
      name: drug.name,
      price: drug.salePrice || 0,
      quantity: 1
    });
  }
  
  renderCart();
  showToast(`تم إضافة ${drug.name} إلى السلة`, 'success');
}

function posSearchDrugs() {
  const query = $('#posSearchInput').value.toLowerCase().trim();
  const results = $('#posResultsList');
  const empty = $('#posResultsEmpty');
  
  if (!query) {
    results.innerHTML = '';
    empty.classList.add('hidden');
    return;
  }
  
  const found = STATE.drugs.filter(d => 
    d.quantity > 0 && (
      d.name.toLowerCase().includes(query) ||
      (d.barcode && d.barcode.includes(query))
    )
  ).slice(0, 8);
  
  if (found.length === 0) {
    results.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  
  results.innerHTML = found.map(drug => `
    <div class="pos-result-item">
      <div class="pos-result-info">
        <strong>${drug.name}</strong>
        <span>${drug.category || ''} • الكمية: ${drug.quantity}</span>
      </div>
      <div class="pos-result-price">${formatCurrency(drug.salePrice || 0)}</div>
      <button class="pos-add-btn" data-pos-add="${drug.id}">+</button>
    </div>
  `).join('');
  
  results.querySelectorAll('[data-pos-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      addToCart(btn.dataset.posAdd);
      $('#posSearchInput').value = '';
      results.innerHTML = '';
      empty.classList.add('hidden');
    });
  });
}

async function checkoutSale() {
  if (STATE.cart.length === 0) {
    showToast('السلة فارغة', 'error');
    return;
  }
  
  for (const item of STATE.cart) {
    const drug = STATE.drugs.find(d => d.id === item.drugId);
    if (!drug) {
      showToast(`الدواء ${item.name} غير موجود في المخزون`, 'error');
      return;
    }
    if (drug.quantity < item.quantity) {
      showToast(`الكمية المطلوبة من ${item.name} (${item.quantity}) غير متوفرة، المتوفر: ${drug.quantity}`, 'error');
      return;
    }
  }
  
  const customerId = $('#cartCustomerSelect').value;
  const customer = STATE.customers.find(c => c.id === customerId);
  const totalAmount = STATE.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const sale = {
    id: generateId().slice(0, 8).toUpperCase(),
    date: getCurrentDateISO(),
    items: STATE.cart.map(item => ({
      drugId: item.drugId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity
    })),
    total: totalAmount,
    customerId: customerId || null,
    customerName: customer ? customer.name : null,
    cashier: STATE.currentUser ? STATE.currentUser.name : 'صيدلاني'
  };
  
  for (const item of STATE.cart) {
    const drug = STATE.drugs.find(d => d.id === item.drugId);
    if (drug) {
      drug.quantity -= item.quantity;
    }
  }
  
  if (customerId) {
    const customer = STATE.customers.find(c => c.id === customerId);
    if (customer) {
      customer.purchaseCount = (customer.purchaseCount || 0) + 1;
      customer.totalSpent = (customer.totalSpent || 0) + totalAmount;
    }
  }
  
  STATE.sales.push(sale);
  STATE.cart = [];
  
  await saveData();
  renderCart();
  renderInventoryTable();
  renderSalesHistory();
  updateKPIs();
  updateDashboardAlerts();
  updateAlertsBadge();
  updateEmployeeSelects();
  
  showToast(`تم إتمام البيع برقم فاتورة #${sale.id}`, 'success');
  printInvoice(sale);
}

function printInvoice(sale) {
  printArea.innerHTML = `
    <div class="invoice-print">
      <h2>${STATE.settings.pharmacyName || 'روشتة'}</h2>
      <p style="text-align:center;font-size:13px;color:#666;margin-top:-4px;">نظام إدارة الصيدلية</p>
      <div class="meta">
        <span>رقم الفاتورة: #${sale.id}</span>
        <span>التاريخ: ${formatDateTime(sale.date)}</span>
      </div>
      <div class="meta">
        <span>الكاشير: ${sale.cashier}</span>
        <span>العميل: ${sale.customerName || '—'}</span>
      </div>
      <table>
        <thead><tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>المجموع</th></tr></thead>
        <tbody>
          ${sale.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${formatCurrency(item.price)}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="total-row">الإجمالي: ${formatCurrency(sale.total)}</div>
      <p style="text-align:center;font-size:11px;color:#999;margin-top:20px;">شكراً لثقتكم بنا</p>
    </div>
  `;
  
  window.print();
}

function renderSalesHistory() {
  const tbody = $('#salesHistoryBody');
  const empty = $('#salesHistoryEmpty');
  const from = $('#salesHistoryFrom').value;
  const to = $('#salesHistoryTo').value;
  const search = $('#salesHistorySearch').value.toLowerCase().trim();
  
  let filtered = STATE.sales.slice().reverse();
  
  if (from) {
    filtered = filtered.filter(s => s.date && s.date >= from);
  }
  if (to) {
    filtered = filtered.filter(s => s.date && s.date <= to + 'T23:59:59');
  }
  if (search) {
    filtered = filtered.filter(s => 
      (s.id && s.id.toLowerCase().includes(search)) ||
      (s.customerName && s.customerName.toLowerCase().includes(search))
    );
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  
  tbody.innerHTML = filtered.map(sale => `
    <tr>
      <td class="cell-mono">#${sale.id}</td>
      <td>${formatDate(sale.date)}</td>
      <td>${sale.customerName || '—'}</td>
      <td>${sale.items ? sale.items.reduce((sum, i) => sum + i.quantity, 0) : 0}</td>
      <td class="cell-strong">${formatCurrency(sale.total)}</td>
      <td>${sale.cashier || '—'}</td>
      <td>
        <button class="icon-action" data-print-sale="${sale.id}">🖨️</button>
      </td>
    </tr>
  `).join('');
  
  tbody.querySelectorAll('[data-print-sale]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sale = STATE.sales.find(s => s.id === btn.dataset.printSale);
      if (sale) printInvoice(sale);
    });
  });
}

// -------------------- العملاء --------------------
function renderCustomersTable() {
  const tbody = $('#customersTableBody');
  const empty = $('#customersEmptyState');
  const search = $('#customerSearchInput').value.toLowerCase().trim();
  
  let filtered = STATE.customers;
  if (search) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(search) ||
      (c.phone && c.phone.includes(search))
    );
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  
  tbody.innerHTML = filtered.map(customer => `
    <tr>
      <td class="cell-strong">${customer.name}</td>
      <td>${customer.phone || '—'}</td>
      <td>${customer.purchaseCount || 0}</td>
      <td>${formatCurrency(customer.totalSpent || 0)}</td>
      <td>${customer.notes || '—'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-action" data-edit-customer="${customer.id}">✏️</button>
          <button class="icon-action danger" data-delete-customer="${customer.id}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
  
  tbody.querySelectorAll('[data-edit-customer]').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditCustomerModal(btn.dataset.editCustomer);
    });
  });
  
  tbody.querySelectorAll('[data-delete-customer]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من حذف هذا العميل؟')) {
        deleteCustomer(btn.dataset.deleteCustomer);
      }
    });
  });
}

async function deleteCustomer(id) {
  STATE.customers = STATE.customers.filter(c => c.id !== id);
  await saveData();
  renderCustomersTable();
  updateEmployeeSelects();
  showToast('تم حذف العميل', 'info');
}

function openEditCustomerModal(id = null) {
  const customer = id ? STATE.customers.find(c => c.id === id) : null;
  STATE.editingCustomerId = id;
  
  const modal = openModal(id ? 'تعديل عميل' : 'إضافة عميل جديد', `
    <form id="customerForm" class="form-grid">
      <div class="form-field full">
        <label>الاسم *</label>
        <input id="customerName" value="${customer ? customer.name : ''}" required>
      </div>
      <div class="form-field">
        <label>رقم الهاتف</label>
        <input id="customerPhone" value="${customer ? customer.phone : ''}">
      </div>
      <div class="form-field full">
        <label>ملاحظات</label>
        <input id="customerNotes" value="${customer ? customer.notes : ''}">
      </div>
      <button type="submit" class="btn btn-primary">${id ? 'حفظ التعديلات' : 'إضافة عميل'}</button>
    </form>
  `);
  
  const form = modal.querySelector('#customerForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCustomerFromForm(modal);
  });
}

async function saveCustomerFromForm(modal) {
  const name = modal.querySelector('#customerName').value.trim();
  const phone = modal.querySelector('#customerPhone').value.trim();
  const notes = modal.querySelector('#customerNotes').value.trim();
  
  if (!name) {
    showToast('يرجى إدخال اسم العميل', 'error');
    return;
  }
  
  if (STATE.editingCustomerId) {
    const index = STATE.customers.findIndex(c => c.id === STATE.editingCustomerId);
    if (index !== -1) {
      STATE.customers[index] = {
        ...STATE.customers[index],
        name,
        phone,
        notes
      };
      showToast('تم تحديث العميل', 'success');
    }
    STATE.editingCustomerId = null;
  } else {
    STATE.customers.push({
      id: generateId(),
      name,
      phone,
      notes,
      purchaseCount: 0,
      totalSpent: 0,
      createdAt: getCurrentDateISO()
    });
    showToast('تم إضافة العميل', 'success');
  }
  
  await saveData();
  modal.remove();
  renderCustomersTable();
  updateEmployeeSelects();
}

// -------------------- الموظفون والصلاحيات --------------------
function renderEmployeesTable() {
  const tbody = $('#employeesTableBody');
  
  if (STATE.employees.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" style="text-align:center;color:var(--c-ink-soft);padding:30px;">لا يوجد موظفون مسجلون</td></tr>
    `;
    return;
  }
  
  tbody.innerHTML = STATE.employees.map(emp => `
    <tr>
      <td class="cell-strong">${emp.name}</td>
      <td>${emp.email}</td>
      <td><span class="badge ${emp.role === 'admin' ? 'badge-ok' : 'badge-neutral'}">${emp.role === 'admin' ? 'مدير' : 'صيدلاني'}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-action" data-edit-employee="${emp.id}">✏️</button>
          <button class="icon-action danger" data-delete-employee="${emp.id}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
  
  tbody.querySelectorAll('[data-edit-employee]').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditEmployeeModal(btn.dataset.editEmployee);
    });
  });
  
  tbody.querySelectorAll('[data-delete-employee]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
        deleteEmployee(btn.dataset.deleteEmployee);
      }
    });
  });
}

async function deleteEmployee(id) {
  STATE.employees = STATE.employees.filter(e => e.id !== id);
  await saveData();
  renderEmployeesTable();
  showToast('تم حذف الموظف', 'info');
}

function openEditEmployeeModal(id = null) {
  const employee = id ? STATE.employees.find(e => e.id === id) : null;
  STATE.editingEmployeeId = id;
  
  const modal = openModal(id ? 'تعديل موظف' : 'إضافة موظف جديد', `
    <form id="employeeForm" class="form-grid">
      <div class="form-field full">
        <label>الاسم *</label>
        <input id="employeeName" value="${employee ? employee.name : ''}" required>
      </div>
      <div class="form-field full">
        <label>البريد الإلكتروني *</label>
        <input type="email" id="employeeEmail" value="${employee ? employee.email : ''}" required ${id ? 'readonly' : ''}>
        <small style="color:var(--c-ink-soft);font-size:11px;">${id ? 'لا يمكن تغيير البريد الإلكتروني بعد الإنشاء' : 'يستخدم البريد الإلكتروني لتسجيل الدخول'}</small>
      </div>
      <div class="form-field full">
        <label>الصلاحية</label>
        <select id="employeeRole">
          <option value="user" ${employee && employee.role === 'user' ? 'selected' : ''}>صيدلاني</option>
          <option value="admin" ${employee && employee.role === 'admin' ? 'selected' : ''}>مدير</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary">${id ? 'حفظ التعديلات' : 'إضافة موظف'}</button>
    </form>
  `);
  
  const form = modal.querySelector('#employeeForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveEmployeeFromForm(modal);
  });
}

async function saveEmployeeFromForm(modal) {
  const name = modal.querySelector('#employeeName').value.trim();
  const email = modal.querySelector('#employeeEmail').value.trim();
  const role = modal.querySelector('#employeeRole').value;
  
  if (!name || !email) {
    showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
    return;
  }
  
  if (STATE.editingEmployeeId) {
    const index = STATE.employees.findIndex(e => e.id === STATE.editingEmployeeId);
    if (index !== -1) {
      STATE.employees[index] = {
        ...STATE.employees[index],
        name,
        role
      };
      showToast('تم تحديث الموظف', 'success');
    }
    STATE.editingEmployeeId = null;
  } else {
    if (STATE.employees.some(e => e.email === email)) {
      showToast('هذا البريد الإلكتروني مستخدم بالفعل', 'error');
      return;
    }
    STATE.employees.push({
      id: generateId(),
      name,
      email,
      role,
      createdAt: getCurrentDateISO()
    });
    showToast('تم إضافة الموظف', 'success');
  }
  
  await saveData();
  modal.remove();
  renderEmployeesTable();
  updateEmployeeSelects();
}

function updateEmployeeSelects() {
  const select = $('#cartCustomerSelect');
  if (select) {
    const currentVal = select.value;
    select.innerHTML = '<option value="">بدون عميل</option>' + 
      STATE.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    select.value = currentVal;
  }
}

// -------------------- التقارير --------------------
function updateReportCharts() {
  updateSalesChart('reportTrendChart');
  updateTopDrugsChart();
  
  const period = $('#reportPeriodSelect').value;
  let filtered = [...STATE.sales];
  
  if (period === 'daily') {
    const now = new Date();
    const days = 14;
    filtered = filtered.filter(s => {
      const d = new Date(s.date);
      return (now - d) / (1000 * 60 * 60 * 24) <= days;
    });
  } else if (period === 'monthly') {
    const now = new Date();
    const months = 12;
    filtered = filtered.filter(s => {
      const d = new Date(s.date);
      return (now - d) / (1000 * 60 * 60 * 24 * 30) <= months;
    });
  }
  
  const total = filtered.reduce((sum, s) => sum + (s.total || 0), 0);
  const count = filtered.length;
  const avg = count > 0 ? total / count : 0;
  
  $('#reportKpiStrip').innerHTML = `
    <div class="kpi-tab accent-primary">
      <div class="kpi-tab-hole2"></div>
      <div class="kpi-label"><span class="dot"></span> إجمالي المبيعات</div>
      <div class="kpi-value">${count}</div>
    </div>
    <div class="kpi-tab accent-clay">
      <div class="kpi-tab-hole2"></div>
      <div class="kpi-label"><span class="dot"></span> الإيرادات</div>
      <div class="kpi-value">${formatCurrency(total)}</div>
    </div>
    <div class="kpi-tab accent-primary">
      <div class="kpi-tab-hole2"></div>
      <div class="kpi-label"><span class="dot"></span> متوسط الفاتورة</div>
      <div class="kpi-value">${formatCurrency(avg)}</div>
    </div>
  `;
}

function updateSalesChart(canvasId = 'salesTrendChart') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const days = 7;
  const labels = [];
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    labels.push(formatDate(dateStr));
    
    const daySales = STATE.sales.filter(s => s.date && s.date.startsWith(dateStr));
    const total = daySales.reduce((sum, s) => sum + (s.total || 0), 0);
    data.push(total);
  }
  
  if (window._salesChart && window._salesChart.destroy) {
    window._salesChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  window._salesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'المبيعات',
        data: data,
        backgroundColor: 'rgba(22, 102, 79, 0.6)',
        borderColor: '#16664F',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' ر.س';
            }
          }
        }
      }
    }
  });
}

function updateTopDrugsChart() {
  const canvas = document.getElementById('topDrugsChart');
  if (!canvas) return;
  
  const drugSales = {};
  STATE.sales.forEach(sale => {
    if (sale.items) {
      sale.items.forEach(item => {
        if (!drugSales[item.name]) drugSales[item.name] = 0;
        drugSales[item.name] += item.quantity;
      });
    }
  });
  
  const sorted = Object.entries(drugSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const labels = sorted.map(item => item[0]);
  const data = sorted.map(item => item[1]);
  
  if (window._topDrugsChart && window._topDrugsChart.destroy) {
    window._topDrugsChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  window._topDrugsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#16664F', '#1F7A5C', '#2A8D6A', '#4CAF50', '#81C784'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 12
          }
        }
      }
    }
  });
}

// -------------------- الإعدادات والنسخ الاحتياطي --------------------
function updateSettingsForm() {
  $('#settingPharmacyName').value = STATE.settings.pharmacyName || '';
  $('#settingCurrency').value = STATE.settings.currency || 'ر.س';
  $('#settingLowStockDefault').value = STATE.settings.lowStockThreshold || 10;
  $('#settingExpiryWarningDays').value = STATE.settings.expiryWarningDays || 30;
}

async function saveSettings() {
  STATE.settings.pharmacyName = $('#settingPharmacyName').value.trim() || 'روشتة';
  STATE.settings.currency = $('#settingCurrency').value.trim() || 'ر.س';
  STATE.settings.lowStockThreshold = parseInt($('#settingLowStockDefault').value) || 10;
  STATE.settings.expiryWarningDays = parseInt($('#settingExpiryWarningDays').value) || 30;
  
  await saveData();
  pharmacyNameDisplay.textContent = STATE.settings.pharmacyName;
  showToast('تم حفظ الإعدادات', 'success');
  updateKPIs();
  updateDashboardAlerts();
  renderInventoryTable();
}

function exportBackup() {
  const data = {
    version: '1.0',
    exportedAt: getCurrentDateISO(),
    settings: STATE.settings,
    drugs: STATE.drugs,
    sales: STATE.sales,
    customers: STATE.customers,
    employees: STATE.employees
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roshita_backup_${getToday()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('تم تنزيل النسخة الاحتياطية', 'success');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.drugs || !data.sales) {
        showToast('ملف النسخة الاحتياطية غير صالح', 'error');
        return;
      }
      
      if (confirm('سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟')) {
        STATE.drugs = data.drugs || [];
        STATE.sales = data.sales || [];
        STATE.customers = data.customers || [];
        STATE.employees = data.employees || [];
        if (data.settings) {
          STATE.settings = data.settings;
        }
        await saveData();
        refreshAllViews();
        showToast('تم استرجاع النسخة الاحتياطية بنجاح', 'success');
      }
    } catch (err) {
      showToast('فشل قراءة الملف: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

async function wipeAllData() {
  if (!confirm('⚠️ تحذير: سيتم حذف جميع البيانات بشكل نهائي. هل أنت متأكد؟')) return;
  if (!confirm('تأكيد نهائي: هل تريد حذف كل شيء؟')) return;
  
  STATE.drugs = [];
  STATE.sales = [];
  STATE.customers = [];
  STATE.employees = [];
  STATE.cart = [];
  await saveData();
  refreshAllViews();
  showToast('تم حذف جميع البيانات', 'info');
}

// -------------------- مستمعات الأحداث --------------------
function initEventListeners() {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (email && password) {
      loginUser(email, password);
    } else {
      showToast('يرجى إدخال البريد الإلكتروني وكلمة المرور', 'error');
    }
  });
  
  togglePassword.addEventListener('click', () => {
    const input = loginPassword;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    eyeIcon.innerHTML = isPassword 
      ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.8"/>'
      : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>';
  });
  
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      if (view) {
        showView(view);
        if (window.innerWidth < 1024) {
          appShell.classList.remove('mobile-nav-open');
        }
      }
    });
  });
  
  sidebarCollapseBtn.addEventListener('click', () => {
    appShell.classList.toggle('sidebar-collapsed');
  });
  
  mobileMenuBtn.addEventListener('click', () => {
    appShell.classList.toggle('mobile-nav-open');
  });
  
  sidebarOverlay.addEventListener('click', () => {
    appShell.classList.remove('mobile-nav-open');
  });
  
  logoutBtn.addEventListener('click', logoutUser);
  
  alertsBtn.addEventListener('click', () => {
    alertsDropdown.classList.toggle('hidden');
    if (!alertsDropdown.classList.contains('hidden')) {
      updateAlertsDropdown();
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.alerts-wrap')) {
      alertsDropdown.classList.add('hidden');
    }
  });
  
  $('#addDrugBtn').addEventListener('click', () => {
    STATE.editingDrugId = null;
    openEditDrugModal(null);
  });
  
  $('#addCustomerBtn').addEventListener('click', () => {
    STATE.editingCustomerId = null;
    openEditCustomerModal(null);
  });
  
  $('#addEmployeeBtn').addEventListener('click', () => {
    STATE.editingEmployeeId = null;
    openEditEmployeeModal(null);
  });
  
  $('#drugSearchInput').addEventListener('input', renderInventoryTable);
  $('#drugCategoryFilter').addEventListener('change', renderInventoryTable);
  $('#drugStockFilter').addEventListener('change', renderInventoryTable);
  
  $('#posSearchInput').addEventListener('input', posSearchDrugs);
  
  $('#checkoutBtn').addEventListener('click', checkoutSale);
  
  $('#salesHistorySearch').addEventListener('input', renderSalesHistory);
  $('#salesHistoryFrom').addEventListener('change', renderSalesHistory);
  $('#salesHistoryTo').addEventListener('change', renderSalesHistory);
  
  $('#customerSearchInput').addEventListener('input', renderCustomersTable);
  
  $('#reportPeriodSelect').addEventListener('change', () => {
    const period = $('#reportPeriodSelect').value;
    const fromWrap = $('#reportFromWrap');
    const toWrap = $('#reportToWrap');
    if (period === 'custom') {
      fromWrap.classList.remove('hidden');
      toWrap.classList.remove('hidden');
    } else {
      fromWrap.classList.add('hidden');
      toWrap.classList.add('hidden');
    }
    updateReportCharts();
  });
  
  $('#reportFrom').addEventListener('change', updateReportCharts);
  $('#reportTo').addEventListener('change', updateReportCharts);
  
  $('#exportReportBtn').addEventListener('click', exportReportCSV);
  
  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });
  
  $('#exportBackupBtn').addEventListener('click', exportBackup);
  $('#importBackupInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importBackup(e.target.files[0]);
      e.target.value = '';
    }
  });
  
  $('#wipeDataBtn').addEventListener('click', wipeAllData);
  
  $$('[data-view-link]').forEach(link => {
    link.addEventListener('click', () => {
      const view = link.dataset.viewLink;
      if (view) showView(view);
    });
  });
  
  $$('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.subtab;
      $$('.subtab-panel').forEach(p => p.classList.remove('active'));
      const panel = $(`#subtab-${target}`);
      if (panel) panel.classList.add('active');
    });
  });
}

// -------------------- تصدير التقرير (CSV) --------------------
function exportReportCSV() {
  const period = $('#reportPeriodSelect').value;
  let filtered = [...STATE.sales];
  
  if (period === 'daily') {
    const now = new Date();
    filtered = filtered.filter(s => {
      const d = new Date(s.date);
      return (now - d) / (1000 * 60 * 60 * 24) <= 14;
    });
  } else if (period === 'monthly') {
    const now = new Date();
    filtered = filtered.filter(s => {
      const d = new Date(s.date);
      return (now - d) / (1000 * 60 * 60 * 24 * 30) <= 12;
    });
  } else if (period === 'custom') {
    const from = $('#reportFrom').value;
    const to = $('#reportTo').value;
    if (from) filtered = filtered.filter(s => s.date && s.date >= from);
    if (to) filtered = filtered.filter(s => s.date && s.date <= to + 'T23:59:59');
  }
  
  if (filtered.length === 0) {
    showToast('لا توجد بيانات للتصدير', 'error');
    return;
  }
  
  let csv = 'رقم الفاتورة,التاريخ,العميل,الإجمالي,الكاشير\n';
  filtered.forEach(sale => {
    csv += `#${sale.id},${formatDate(sale.date)},${sale.customerName || ''},${sale.total || 0},${sale.cashier || ''}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report_${getToday()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('تم تصدير التقرير', 'success');
}

// -------------------- تحديث قائمة التنبيهات المنسدلة --------------------
function updateAlertsDropdown() {
  const alerts = getAlerts();
  if (alerts.length === 0) {
    alertsDropdownList.innerHTML = `<div class="no-alerts">✅ لا توجد تنبيهات</div>`;
    return;
  }
  
  alertsDropdownList.innerHTML = alerts.map(alert => `
    <div class="alert-item severity-${alert.severity}" style="padding:8px 12px;border:none;border-bottom:1px solid #f0f0f0;">
      <div class="alert-item-text">
        <strong style="font-size:13px;">${alert.title}</strong>
        <span style="font-size:11.5px;">${alert.message}</span>
      </div>
    </div>
  `).join('');
}

// -------------------- التشغيل الأولي --------------------
loadAllDataFromFirebase();
checkAuthState();
initEventListeners();

// تصدير بعض الدوال للاستخدام في console
window.__STATE = STATE;
window.__saveData = saveData;
window.__loadData = loadAllDataFromFirebase;

console.log('🚀 روشتة — نظام إدارة الصيدلية (مع Firebase)');
console.log('💾 جميع البيانات محفوظة في السحاب');
console.log('📱 متوفر على جميع الأجهزة');
