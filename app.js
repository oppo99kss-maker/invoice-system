// App Data Storage
const STORAGE_KEY = 'invoice_system_data_v2';
let currentUser = sessionStorage.getItem('activeUser') || null;

// User database with SHA-256 hashes of passwords
const USER_DATABASE = {
    't': '84779f58b8b960ef64ee6c383bb16c7acaceec2a752398ca8af6a0b9b98e7a9b',     // password: t12345
    'user2': '8fbe8e13a025185501f49e0fbefc071711b2b78dfc3f2e31dd75747e19fa0f42', // password: user2pass
    'user3': 'd48b9943c97a1cc654ec36b968d1158a9be20adcb2a8622b0289587ff09fee8f', // password: user3pass
    'user4': '362d2407838669638352e59ce26994233ce93cc0e5a5b2b0e7c0db86827aacfb', // password: user4pass
    'user5': '3561efeaa7e34be26c2147b8e4bfba739e7f4ecb1fcd5a01900d864502e33749'  // password: user5pass
};

let appData = {
    settings: {
        my_name: '',
        my_address: '',
        my_phone: '',
        my_bank: '',
        my_iban: '',
        show_bank: true,
        show_barcode: false,
        default_lang: 'ar',
        default_quote_notes: 'هذا العرض سارٍ لمدة 7 أيام من تاريخ الإصدار.',
        default_invoice_notes: 'نشكر لكم تعاملكم معنا. البضاعة المباعة لا ترد ولا تستبدل.',
        my_currency: 'ر.س',
        theme: 'light',
        logo: '', // Base64
        signature: '', // Base64
        iban_barcode: '' // Base64
    },
    clients: [], // { id, name, address, city, neighborhood, zip, taxNum }
    resources: [], // { id, name, desc, price, unit }
    invoices: [] // { id, docNum, type: 'quote'|'invoice'|'maintenance', date, expiryDays, clientId, items: [], subtotal, totalDiscount, grandTotal, notes, paymentStatus, amountPaid, isPaid, nextMaintenanceDate }
};

// Global Temp Items for builder
let currentInvoiceItems = [];

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Bind login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLogin();
        });
    }

    // Bind logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    checkLoginState();
    
    initNavigation();
    bindSettings();
    
    // Bind search and filter triggers
    setupSearchFilters();
    
    setupModals();
    setupInvoiceBuilder();
});

// --- Authentication Management ---
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleLogin() {
    const usernameInput = document.getElementById('loginUsername').value.trim().toLowerCase();
    const passwordInput = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');
    
    if (!usernameInput || !passwordInput) return;
    
    const hashedPassword = await sha256(passwordInput);
    
    if (USER_DATABASE[usernameInput] && USER_DATABASE[usernameInput] === hashedPassword) {
        sessionStorage.setItem('activeUser', usernameInput);
        currentUser = usernameInput;
        
        const overlay = document.getElementById('loginOverlay');
        if (overlay) overlay.style.display = 'none';
        
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        if (errorMsg) errorMsg.style.display = 'none';
        
        document.getElementById('activeUserLabel').innerText = `المستخدم: ${currentUser}`;
        
        loadData();
        updateAllViews();
        initTheme();
    } else {
        if (errorMsg) errorMsg.style.display = 'block';
    }
}

function handleLogout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        sessionStorage.removeItem('activeUser');
        currentUser = null;
        
        const overlay = document.getElementById('loginOverlay');
        if (overlay) overlay.style.display = 'flex';
        
        document.getElementById('activeUserLabel').innerText = 'المستخدم: ...';
        
        resetAppData();
        updateAllViews();
    }
}

function checkLoginState() {
    const activeUser = sessionStorage.getItem('activeUser');
    const overlay = document.getElementById('loginOverlay');
    
    if (activeUser) {
        currentUser = activeUser;
        if (overlay) overlay.style.display = 'none';
        document.getElementById('activeUserLabel').innerText = `المستخدم: ${currentUser}`;
        loadData();
        updateAllViews();
        initTheme();
    } else {
        currentUser = null;
        if (overlay) overlay.style.display = 'flex';
        resetAppData();
        updateAllViews();
    }
}

function resetAppData() {
    appData = {
        settings: {
            my_name: '',
            my_address: '',
            my_phone: '',
            my_bank: '',
            my_iban: '',
            show_bank: true,
            show_barcode: false,
            default_lang: 'ar',
            default_quote_notes: 'هذا العرض سارٍ لمدة 7 أيام من تاريخ الإصدار.',
            default_invoice_notes: 'نشكر لكم تعاملكم معنا. البضاعة المباعة لا ترد ولا تستبدل.',
            my_currency: 'ر.س',
            theme: 'light',
            logo: '',
            signature: '',
            iban_barcode: ''
        },
        clients: [],
        resources: [],
        invoices: []
    };
}

// --- Data Management ---
function getStorageKey() {
    return currentUser ? `${STORAGE_KEY}_${currentUser}` : STORAGE_KEY;
}

function loadData() {
    if (!currentUser) return;
    
    const userKey = getStorageKey();
    let data = localStorage.getItem(userKey);
    
    // ترحيل البيانات القديمة لحساب t فقط عند الدخول الأول له
    if (currentUser === 't' && !data) {
        const oldDataV2 = localStorage.getItem(STORAGE_KEY);
        if (oldDataV2) {
            try {
                localStorage.setItem(userKey, oldDataV2);
                data = oldDataV2;
                localStorage.removeItem(STORAGE_KEY);
                console.log("تم ترحيل البيانات القديمة v2 بنجاح لحساب t");
            } catch (e) {
                console.error("خطأ في ترحيل v2:", e);
            }
        } else {
            const oldDataV1 = localStorage.getItem('invoice_system_data_v1');
            if (oldDataV1) {
                try {
                    const parsedOld = JSON.parse(oldDataV1);
                    appData.settings = { ...appData.settings, ...parsedOld.settings };
                    appData.clients = parsedOld.clients || [];
                    appData.resources = (parsedOld.resources || []).map(r => ({
                        ...r,
                        unit: r.unit || 'حبة'
                    }));
                    appData.invoices = parsedOld.invoices || [];
                    
                    localStorage.setItem(userKey, JSON.stringify(appData));
                    data = JSON.stringify(appData);
                    localStorage.removeItem('invoice_system_data_v1');
                    console.log("تم ترحيل البيانات القديمة v1 بنجاح لحساب t");
                } catch (err) {
                    console.error("خطأ أثناء ترحيل البيانات القديمة v1:", err);
                }
            }
        }
    }
    
    if (data) {
        try {
            const parsed = JSON.parse(data);
            appData.settings = { ...appData.settings, ...parsed.settings };
            appData.clients = parsed.clients || [];
            appData.resources = (parsed.resources || []).map(r => ({
                ...r,
                unit: r.unit || 'حبة'
            }));
            appData.invoices = parsed.invoices || [];
        } catch (err) {
            console.error("خطأ في قراءة البيانات المحفوظة:", err);
        }
    } else {
        resetAppData();
    }
    populateSettingsInputs();
}

function saveData() {
    if (!currentUser) return;
    localStorage.setItem(getStorageKey(), JSON.stringify(appData));
    updateAllViews();
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function updateAllViews() {
    renderClients();
    renderResources();
    renderInvoices();
    updateDashboardAnalytics();
}

// --- Theme Management ---
function initTheme() {
    const theme = appData.settings.theme || 'light';
    const body = document.body;
    const btn = document.getElementById('themeToggleBtn');
    
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i> <span>الوضع الفاتح</span>';
    } else {
        body.classList.remove('dark-mode');
        if (btn) btn.innerHTML = '<i class="fas fa-moon"></i> <span>الوضع الداكن</span>';
    }
}

// --- Navigation ---
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.page-section');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            link.classList.add('active');
            const target = link.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
        });
    });

    // Sub Tabs inside Dashboard
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        });
    });
}

// --- Search and Filters ---
function setupSearchFilters() {
    // Clients Search
    const searchClients = document.getElementById('searchClients');
    if (searchClients) {
        searchClients.addEventListener('input', (e) => {
            renderClients(e.target.value.trim());
        });
    }

    // Resources Search
    const searchResources = document.getElementById('searchResources');
    if (searchResources) {
        searchResources.addEventListener('input', (e) => {
            renderResources(e.target.value.trim());
        });
    }

    // Invoices Search & filters
    const searchInvoices = document.getElementById('searchInvoices');
    const filterType = document.getElementById('filterInvoiceType');
    const filterStatus = document.getElementById('filterInvoiceStatus');

    const triggerInvoiceSearch = () => {
        const query = searchInvoices ? searchInvoices.value.trim() : '';
        const type = filterType ? filterType.value : '';
        const status = filterStatus ? filterStatus.value : '';
        renderInvoices(query, type, status);
    };

    if (searchInvoices) searchInvoices.addEventListener('input', triggerInvoiceSearch);
    if (filterType) filterType.addEventListener('change', triggerInvoiceSearch);
    if (filterStatus) filterStatus.addEventListener('change', triggerInvoiceSearch);
}

// --- Modals ---
function openModal(modalId, itemId = null, isNewInvoice = false) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = 'block';

    if (modalId === 'clientModal') {
        const title = document.getElementById('clientModalTitle');
        if (itemId) {
            title.innerText = 'تعديل بيانات العميل';
            const client = appData.clients.find(c => c.id === itemId);
            if (client) {
                document.getElementById('clientId').value = client.id;
                document.getElementById('clientName').value = client.name;
                document.getElementById('clientAddress').value = client.address || '';
                document.getElementById('clientCity').value = client.city || '';
                document.getElementById('clientNeighborhood').value = client.neighborhood || '';
                document.getElementById('clientZip').value = client.zip || '';
                document.getElementById('clientTaxNum').value = client.taxNum || '';
            }
        } else {
            title.innerText = 'إضافة عميل جديد';
            document.getElementById('clientId').value = '';
            document.getElementById('clientName').value = '';
            document.getElementById('clientAddress').value = '';
            document.getElementById('clientCity').value = '';
            document.getElementById('clientNeighborhood').value = '';
            document.getElementById('clientZip').value = '';
            document.getElementById('clientTaxNum').value = '';
        }
    } else if (modalId === 'resourceModal') {
        const title = document.getElementById('resourceModalTitle');
        if (itemId) {
            title.innerText = 'تعديل صنف';
            const res = appData.resources.find(r => r.id === itemId);
            if (res) {
                document.getElementById('resourceId').value = res.id;
                document.getElementById('resourceName').value = res.name;
                document.getElementById('resourceDesc').value = res.desc || '';
                document.getElementById('resourcePrice').value = res.price || 0;
                document.getElementById('resourceUnit').value = res.unit || '';
            }
        } else {
            title.innerText = 'إضافة صنف جديد';
            document.getElementById('resourceId').value = '';
            document.getElementById('resourceName').value = '';
            document.getElementById('resourceDesc').value = '';
            document.getElementById('resourcePrice').value = '';
            document.getElementById('resourceUnit').value = '';
        }
    } else if (modalId === 'invoiceModal') {
        // دائماً قم بتعبئة قوائم العملاء والبنود المنسدلة للتأكد من وجود الخيارات قبل ملء النموذج
        const clientSelect = document.getElementById('invClientSelect');
        if (clientSelect) {
            clientSelect.innerHTML = '<option value="">-- اختر العميل --</option>';
            appData.clients.forEach(c => {
                clientSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
        populateInvoiceItemSelect();

        if (isNewInvoice) {
            resetInvoiceBuilder();
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function setupModals() {
    document.querySelectorAll('.close-modal, .close-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.modal').style.display = 'none';
        });
    });

    window.onclick = function (event) {
        if (event.target.classList.contains('modal')) {
            // "التاكد من عند فتح صفحة الفاتورة لاتغلق بمجرد الضغط بعيد عنها"
            if (event.target.id === 'invoiceModal') {
                return; // Do NOT close invoice modal when clicking outside
            }
            event.target.style.display = 'none';
        }
    }
}

// --- Dashboard & Settings ---
function populateSettingsInputs() {
    const s = appData.settings;
    document.getElementById('my_name').value = s.my_name || '';
    document.getElementById('my_address').value = s.my_address || '';
    document.getElementById('my_phone').value = s.my_phone || '';
    document.getElementById('my_bank').value = s.my_bank || '';
    document.getElementById('my_iban').value = s.my_iban || '';
    document.getElementById('show_bank').checked = s.show_bank !== false;
    document.getElementById('show_barcode').checked = s.show_barcode || false;
    document.getElementById('default_lang').value = s.default_lang || 'ar';
    document.getElementById('default_quote_notes').value = s.default_quote_notes || '';
    document.getElementById('default_invoice_notes').value = s.default_invoice_notes || '';
    document.getElementById('my_currency').value = s.my_currency || 'ر.س';

    if (s.logo) {
        document.getElementById('logo_img').src = s.logo;
        document.getElementById('logo_img').style.display = 'block';
        document.querySelector('#logo_preview .placeholder-text').style.display = 'none';
        document.getElementById('clear_logo').style.display = 'inline-block';
    }
    if (s.signature) {
        document.getElementById('signature_img').src = s.signature;
        document.getElementById('signature_img').style.display = 'block';
        document.querySelector('#signature_preview .placeholder-text').style.display = 'none';
        document.getElementById('clear_signature').style.display = 'inline-block';
    }
    if (s.iban_barcode) {
        document.getElementById('barcode_img').src = s.iban_barcode;
        document.getElementById('barcode_img').style.display = 'block';
        document.querySelector('#barcode_preview .placeholder-text').style.display = 'none';
        document.getElementById('clear_barcode').style.display = 'inline-block';
    }
}

function bindSettings() {
    const inputs = ['my_name', 'my_address', 'my_phone', 'my_bank', 'my_iban', 'default_quote_notes', 'default_invoice_notes', 'my_currency'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            appData.settings[id] = e.target.value;
            saveData();
        });
    });

    const toggles = ['show_bank', 'show_barcode'];
    toggles.forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            appData.settings[id] = e.target.checked;
            saveData();
        });
    });

    document.getElementById('default_lang').addEventListener('change', (e) => {
        appData.settings.default_lang = e.target.value;
        saveData();
    });

    // Dark Mode Toggle
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        const body = document.body;
        const btn = document.getElementById('themeToggleBtn');
        if (body.classList.contains('dark-mode')) {
            body.classList.remove('dark-mode');
            btn.innerHTML = '<i class="fas fa-moon"></i> <span>الوضع الداكن</span>';
            appData.settings.theme = 'light';
        } else {
            body.classList.add('dark-mode');
            btn.innerHTML = '<i class="fas fa-sun"></i> <span>الوضع الفاتح</span>';
            appData.settings.theme = 'dark';
        }
        saveData();
    });

    // Preview Page Language Toggle
    document.getElementById('preview_lang').addEventListener('change', (e) => {
        if (window.currentPreviewDoc) {
            renderPrintLayout(window.currentPreviewDoc, e.target.value);
        }
    });

    // Image Uploads
    setupImageUpload('logo_upload', 'logo_preview', 'logo_img', 'clear_logo', 'logo');
    setupImageUpload('signature_upload', 'signature_preview', 'signature_img', 'clear_signature', 'signature');
    setupImageUpload('barcode_upload', 'barcode_preview', 'barcode_img', 'clear_barcode', 'iban_barcode');
}

function setupImageUpload(inputId, previewId, imgId, clearId, settingKey) {
    const fileInput = document.getElementById(inputId);
    const previewBox = document.getElementById(previewId);
    const imgEl = document.getElementById(imgId);
    const clearBtn = document.getElementById(clearId);
    const placeholder = previewBox.querySelector('.placeholder-text');

    previewBox.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64 = e.target.result;
                appData.settings[settingKey] = base64;
                saveData();
                imgEl.src = base64;
                imgEl.style.display = 'block';
                placeholder.style.display = 'none';
                clearBtn.style.display = 'inline-block';
            };
            reader.readAsDataURL(this.files[0]);
        }
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        appData.settings[settingKey] = '';
        saveData();
        imgEl.src = '';
        imgEl.style.display = 'none';
        placeholder.style.display = 'block';
        clearBtn.style.display = 'none';
        fileInput.value = "";
    });
}

// --- Clients ---
document.getElementById('saveClientBtn').addEventListener('click', () => {
    const id = document.getElementById('clientId').value;
    const name = document.getElementById('clientName').value.trim();
    if (!name) { alert('اسم العميل مطلوب'); return; }

    const clientData = {
        name,
        address: document.getElementById('clientAddress').value.trim(),
        city: document.getElementById('clientCity').value.trim(),
        neighborhood: document.getElementById('clientNeighborhood').value.trim(),
        zip: document.getElementById('clientZip').value.trim(),
        taxNum: document.getElementById('clientTaxNum').value.trim()
    };

    if (id) {
        const index = appData.clients.findIndex(c => c.id === id);
        if (index > -1) {
            appData.clients[index] = { ...appData.clients[index], ...clientData };
        }
    } else {
        clientData.id = generateId();
        appData.clients.push(clientData);
    }

    saveData();
    closeModal('clientModal');
    renderClients();
});

function renderClients(searchQuery = '') {
    const tbody = document.querySelector('#clients-table tbody');
    const emptyState = document.getElementById('clients-empty');
    const table = document.getElementById('clients-table');
    tbody.innerHTML = '';

    const list = appData.clients.filter(c => {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.city && c.city.toLowerCase().includes(q));
    });

    if (list.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    list.forEach(client => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${client.name}</strong></td>
            <td>${client.city || '-'}</td>
            <td>${client.address || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="openModal('clientModal', '${client.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline btn-danger" onclick="deleteClient('${client.id}')" title="حذف"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteClient(id) {
    if (confirm('هل أنت متأكد من حذف العميل؟')) {
        appData.clients = appData.clients.filter(c => c.id !== id);
        saveData();
        renderClients();
    }
}

// --- Resources (Items & Services) ---
document.getElementById('saveResourceBtn').addEventListener('click', () => {
    const id = document.getElementById('resourceId').value;
    const name = document.getElementById('resourceName').value.trim();
    const price = parseFloat(document.getElementById('resourcePrice').value);
    const unit = document.getElementById('resourceUnit').value.trim();

    if (!name || isNaN(price)) { alert('الاسم والسعر مطلوبان'); return; }

    const resData = {
        name,
        desc: document.getElementById('resourceDesc').value.trim(),
        price,
        unit: unit || 'حبة'
    };

    if (id) {
        const index = appData.resources.findIndex(r => r.id === id);
        if (index > -1) {
            appData.resources[index] = { ...appData.resources[index], ...resData };
        }
    } else {
        resData.id = generateId();
        appData.resources.push(resData);
    }

    saveData();
    closeModal('resourceModal');
    renderResources();
});

function renderResources(searchQuery = '') {
    const tbody = document.querySelector('#items-table tbody');
    const emptyState = document.getElementById('items-empty');
    const table = document.getElementById('items-table');
    tbody.innerHTML = '';

    const list = appData.resources.filter(r => {
        const q = searchQuery.toLowerCase();
        return r.name.toLowerCase().includes(q) || (r.desc && r.desc.toLowerCase().includes(q));
    });

    if (list.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    const currency = appData.settings.my_currency || 'ر.س';

    list.forEach(res => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${res.name}</strong></td>
            <td>${res.desc || '-'}</td>
            <td>${res.unit || 'حبة'}</td>
            <td>${res.price.toFixed(2)} ${currency}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="openModal('resourceModal', '${res.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline btn-danger" onclick="deleteResource('${res.id}')" title="حذف"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteResource(id) {
    if (confirm('هل أنت متأكد من حذف الصنف؟')) {
        appData.resources = appData.resources.filter(r => r.id !== id);
        saveData();
        renderResources();
    }
}

// --- Invoice Builder ---
function resetInvoiceBuilder() {
    currentInvoiceItems = [];
    document.getElementById('invDate').valueAsDate = new Date();
    document.getElementById('invHasExpiry').checked = false;
    document.getElementById('invExpiryDays').disabled = true;
    document.getElementById('invExpiryDays').value = '';
    document.getElementById('invLocalNotes').value = '';
    document.getElementById('invNextMaintenanceDate').value = '';
    
    // Set type dropdown defaults
    const invTypeSelect = document.getElementById('invType');
    invTypeSelect.value = 'quote';
    
    // Remove temporary tags
    const btn = document.getElementById('saveInvoiceBtn');
    btn.removeAttribute('data-existing-id');
    btn.removeAttribute('data-converting');

    // Populate Clients
    const clientSelect = document.getElementById('invClientSelect');
    clientSelect.innerHTML = '<option value="">-- اختر العميل --</option>';
    appData.clients.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });

    // Populate Resources dropdown
    populateInvoiceItemSelect();

    // Trigger visual layout adaptations based on 'quote' type
    updateInvoiceBuilderType('quote');
    renderInvoiceItemsTable();
}

function populateInvoiceItemSelect() {
    const itemSelect = document.getElementById('invItemSelect');
    itemSelect.innerHTML = '<option value="">-- اختر صنفاً من قائمة البنود --</option>';
    appData.resources.forEach(i => {
        itemSelect.innerHTML += `<option value="${i.id}">${i.name} (${i.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</option>`;
    });
}

// adapts elements based on quote/invoice/maintenance type selection
function updateInvoiceBuilderType(type, isExisting = false, docNum = '') {
    const isConverting = document.getElementById('saveInvoiceBtn').getAttribute('data-converting');
    
    const paymentSec = document.getElementById('invPaymentSection');
    const nextMaintGrp = document.getElementById('invNextMaintGroup');
    const expiryGrp = document.getElementById('invExpiryGroup');
    const title = document.getElementById('invoiceModalTitle');
    const docNumLabel = document.getElementById('invDocNumLabel');
    const saveBtn = document.getElementById('saveInvoiceBtn');
    
    if (type === 'quote') {
        paymentSec.style.display = 'none';
        nextMaintGrp.style.display = 'none';
        expiryGrp.style.display = 'block';
        title.innerText = isExisting ? `تعديل عرض السعر #${docNum}` : 'إنشاء عرض سعر جديد';
        docNumLabel.innerText = 'رقم العرض *';
        saveBtn.innerText = isExisting ? 'حفظ التعديلات' : 'حفظ كـ عرض سعر';
        if (!isExisting) {
            document.getElementById('invDocNum').value = getNextDocNumStr('quote');
        }
    } else if (type === 'invoice') {
        paymentSec.style.display = 'block';
        nextMaintGrp.style.display = 'none';
        expiryGrp.style.display = 'none';
        title.innerText = isConverting ? 'تحويل عرض السعر إلى فاتورة' : (isExisting ? `تعديل الفاتورة #${docNum}` : 'إنشاء فاتورة إلكترونية جديدة');
        docNumLabel.innerText = 'رقم الفاتورة *';
        saveBtn.innerText = isExisting ? 'حفظ التعديلات' : 'حفظ كـ فاتورة إلكترونية';
        if (!isExisting) {
            document.getElementById('invDocNum').value = getNextDocNumStr('invoice');
        }
    } else if (type === 'maintenance') {
        paymentSec.style.display = 'block';
        nextMaintGrp.style.display = 'block';
        expiryGrp.style.display = 'none';
        title.innerText = isExisting ? `تعديل فاتورة الصيانة #${docNum}` : 'إنشاء فاتورة صيانة جديدة';
        docNumLabel.innerText = 'رقم الفاتورة *';
        saveBtn.innerText = isExisting ? 'حفظ التعديلات' : 'حفظ كـ فاتورة صيانة';
        if (!isExisting) {
            document.getElementById('invDocNum').value = getNextDocNumStr('maintenance');
        }
    }
}

// Bind Type Selector Change inside builder
document.getElementById('invType').addEventListener('change', (e) => {
    const isExisting = document.getElementById('saveInvoiceBtn').getAttribute('data-existing-id');
    const docNum = document.getElementById('invDocNum').value;
    updateInvoiceBuilderType(e.target.value, !!isExisting, docNum);
});

document.getElementById('invHasExpiry').addEventListener('change', (e) => {
    document.getElementById('invExpiryDays').disabled = !e.target.checked;
});

// "عند تعديل الاصناف وضع بينات الصنف كاملة حتى لااكتبها من جديد"
document.getElementById('invAddItemBtn').addEventListener('click', () => {
    const resId = document.getElementById('invItemSelect').value;
    if (!resId) return;

    const res = appData.resources.find(r => r.id === resId);
    if (res) {
        currentInvoiceItems.push({
            id: generateId(),
            resourceId: res.id,
            name: res.name,
            desc: res.desc || '', // Copy Description
            qty: 1,
            price: res.price || 0, // Copy Price
            discount: 0,
            unit: res.unit || 'حبة' // Copy Unit
        });
        renderInvoiceItemsTable();
    }
});

document.getElementById('invAddNewCustomItemBtn').addEventListener('click', () => {
    const name = prompt("أدخل اسم البند الجديد:");
    if (!name) return;
    const desc = prompt("أدخل وصف البند البصري/التفصيلي (اختياري):") || "";
    const priceStr = prompt("أدخل السعر الافتراضي للقطعة:");
    const price = parseFloat(priceStr) || 0;
    const unit = prompt("أدخل الوحدة (مثال: حبة، ساعة...):") || "حبة";

    const newRes = {
        id: generateId(),
        name,
        desc,
        price,
        unit
    };
    appData.resources.push(newRes);
    saveData(); // Save to database

    currentInvoiceItems.push({
        id: generateId(),
        resourceId: newRes.id,
        name: newRes.name,
        desc: newRes.desc,
        qty: 1,
        price: newRes.price,
        discount: 0,
        unit: newRes.unit
    });

    renderInvoiceItemsTable();
    populateInvoiceItemSelect();
});

// Utility to parse Arabic numbers safely
function parseArNum(val) {
    if (!val && val !== 0) return 0;
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let safeStr = String(val).replace(/[٠-٩]/g, function (w) {
        return arabicNumbers.indexOf(w);
    });
    return parseFloat(safeStr) || 0;
}

function updateInvoiceTotalsDOM() {
    let subtotal = 0;
    let totalDiscount = 0;

    currentInvoiceItems.forEach((item, index) => {
        const itemTotal = (item.price * item.qty) - item.discount;
        subtotal += (item.price * item.qty);
        totalDiscount += parseFloat(item.discount || 0);

        // Update row total cell
        const tbody = document.getElementById('invBuilderItems');
        if (tbody.children[index] && tbody.children[index].children[5]) {
            tbody.children[index].children[5].innerText = itemTotal.toFixed(2);
        }
    });

    document.getElementById('invSubtotal').innerText = subtotal.toFixed(2);
    document.getElementById('invTotalDiscount').innerText = totalDiscount.toFixed(2);

    const grandTotal = subtotal - totalDiscount;
    document.getElementById('invGrandTotal').innerText = grandTotal.toFixed(2);
}

function renderInvoiceItemsTable() {
    const tbody = document.getElementById('invBuilderItems');
    tbody.innerHTML = '';

    currentInvoiceItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align: right;">
                <input type="text" class="inv-item-name" data-index="${index}" value="${item.name}">
                <input type="text" class="inv-item-desc" data-index="${index}" value="${item.desc || ''}" placeholder="أدخل الوصف (اختياري)..." style="font-size:0.8rem; color:#64748b; width:100%; border:none; margin-top:4px; background:transparent;">
            </td>
            <td><input type="text" inputmode="numeric" class="inv-item-qty" data-index="${index}" value="${item.qty}"></td>
            <td><input type="text" inputmode="decimal" class="inv-item-price" data-index="${index}" value="${item.price}"></td>
            <td><input type="text" inputmode="decimal" class="inv-item-disc" data-index="${index}" value="${item.discount}"></td>
            <td>0.00</td>
            <td>
                <button class="btn btn-sm btn-danger btn-outline" onclick="removeInvItem(${index})" title="حذف البند"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateInvoiceTotalsDOM();

    // Bind inputs
    document.querySelectorAll('.inv-item-name').forEach(inp => {
        inp.addEventListener('input', (e) => {
            currentInvoiceItems[e.target.dataset.index].name = e.target.value;
        });
    });
    document.querySelectorAll('.inv-item-desc').forEach(inp => {
        inp.addEventListener('input', (e) => {
            currentInvoiceItems[e.target.dataset.index].desc = e.target.value;
        });
    });
    document.querySelectorAll('.inv-item-qty').forEach(inp => {
        inp.addEventListener('input', (e) => {
            currentInvoiceItems[e.target.dataset.index].qty = parseArNum(e.target.value);
            updateInvoiceTotalsDOM();
        });
    });
    document.querySelectorAll('.inv-item-price').forEach(inp => {
        inp.addEventListener('input', (e) => {
            currentInvoiceItems[e.target.dataset.index].price = parseArNum(e.target.value);
            updateInvoiceTotalsDOM();
        });
    });
    document.querySelectorAll('.inv-item-disc').forEach(inp => {
        inp.addEventListener('input', (e) => {
            currentInvoiceItems[e.target.dataset.index].discount = parseArNum(e.target.value);
            updateInvoiceTotalsDOM();
        });
    });
}

window.removeInvItem = function (index) {
    currentInvoiceItems.splice(index, 1);
    renderInvoiceItemsTable();
};

document.getElementById('invPaymentStatus').addEventListener('change', (e) => {
    document.getElementById('invAmountPaidGrp').style.display = e.target.value === 'partial' ? 'block' : 'none';
});

// Calculate current builder totals
function calculateCurrentTotals() {
    let subtotal = 0;
    let totalDiscount = 0;
    currentInvoiceItems.forEach(i => {
        subtotal += (i.price * i.qty);
        totalDiscount += (parseFloat(i.discount) || 0);
    });

    return {
        subtotal,
        totalDiscount,
        grandTotal: subtotal - totalDiscount
    };
}

function getNextDocNumStr(type) {
    const docs = appData.invoices.filter(i => i.type === type);
    let prefix = 'QT-';
    if (type === 'invoice') prefix = 'INV-';
    if (type === 'maintenance') prefix = 'MT-';

    if (docs.length === 0) {
        return prefix + '1001';
    }

    // Sort to find the latest
    const sorted = [...docs].sort((a, b) => a.docNum.localeCompare(b.docNum));
    const lastDoc = sorted[sorted.length - 1];
    const lastNumStr = String(lastDoc.docNum);

    const match = lastNumStr.match(/^(.*?)(\d+)$/);
    if (match) {
        const p = match[1];
        const num = parseInt(match[2], 10) + 1;
        return p + num;
    } else {
        return prefix + '1001';
    }
}

// Setup builder modal triggers
function setupInvoiceBuilder() {
    document.getElementById('saveInvoiceBtn').addEventListener('click', () => {
        const clientId = document.getElementById('invClientSelect').value;
        if (!clientId) { alert('يجب تحديد العميل'); return; }
        if (currentInvoiceItems.length === 0) { alert('يجب إضافة صنف واحد على الأقل'); return; }

        const docNumVal = document.getElementById('invDocNum').value.trim();
        if (!docNumVal) { alert('يجب إدخال رقم المستند'); return; }

        const isExisting = document.getElementById('saveInvoiceBtn').getAttribute('data-existing-id');
        const isConverting = document.getElementById('saveInvoiceBtn').getAttribute('data-converting');

        const selectedType = document.getElementById('invType').value;

        let hasExpiry = document.getElementById('invHasExpiry').checked;
        let expiryDays = parseInt(document.getElementById('invExpiryDays').value) || null;

        const totals = calculateCurrentTotals();

        const invoiceData = {
            type: selectedType,
            clientId,
            date: document.getElementById('invDate').value,
            expiryDays: (selectedType === 'quote' && hasExpiry) ? expiryDays : null,
            items: JSON.parse(JSON.stringify(currentInvoiceItems)),
            notes: document.getElementById('invLocalNotes').value.trim(),
            ...totals
        };

        // Payment attributes for Invoice / Maintenance
        if (selectedType !== 'quote') {
            const payStatus = document.getElementById('invPaymentStatus').value;
            invoiceData.paymentStatus = payStatus;
            if (payStatus === 'paid') {
                invoiceData.amountPaid = totals.grandTotal;
                invoiceData.isPaid = true;
            } else if (payStatus === 'partial') {
                invoiceData.amountPaid = parseFloat(document.getElementById('invAmountPaid').value) || 0;
                invoiceData.isPaid = false;
            } else {
                invoiceData.amountPaid = 0;
                invoiceData.isPaid = false;
            }
        } else {
            invoiceData.paymentStatus = 'unpaid';
            invoiceData.amountPaid = 0;
            invoiceData.isPaid = false;
        }

        // Maintenance specific
        if (selectedType === 'maintenance' && document.getElementById('invNextMaintenanceDate').value) {
            invoiceData.nextMaintenanceDate = document.getElementById('invNextMaintenanceDate').value;
        } else {
            invoiceData.nextMaintenanceDate = '';
        }

        if (isExisting && !isConverting) {
            // Update Existing
            const idx = appData.invoices.findIndex(i => i.id === isExisting);
            if (idx > -1) {
                invoiceData.docNum = docNumVal;
                appData.invoices[idx] = { ...appData.invoices[idx], ...invoiceData };
            }
        } else {
            // Create New
            invoiceData.id = generateId();
            invoiceData.docNum = docNumVal;
            if (isConverting) {
                invoiceData.date = new Date().toISOString().split('T')[0]; // Set date to today
                // Link quotation id if converting
                invoiceData.quoteId = isConverting;
                // Delete quotation or keep it? Keep it but let's change status or keep it clean
            }
            appData.invoices.push(invoiceData);
        }

        saveData();
        closeModal('invoiceModal');
        document.getElementById('saveInvoiceBtn').removeAttribute('data-existing-id');
        document.getElementById('saveInvoiceBtn').removeAttribute('data-converting');
    });
}

// --- List Invoices ---
function renderInvoices(searchQuery = '', typeFilter = '', statusFilter = '') {
    const tbody = document.querySelector('#invoices-table tbody');
    const emptyState = document.getElementById('invoices-empty');
    const table = document.getElementById('invoices-table');
    tbody.innerHTML = '';

    let list = appData.invoices;

    // Apply Filters
    if (typeFilter) {
        list = list.filter(i => i.type === typeFilter);
    }
    if (statusFilter) {
        list = list.filter(i => {
            if (i.type === 'quote') return false; // quotes don't have pay status
            return i.paymentStatus === statusFilter;
        });
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter(i => {
            const client = appData.clients.find(c => c.id === i.clientId);
            return i.docNum.toLowerCase().includes(q) || (client && client.name.toLowerCase().includes(q));
        });
    }

    if (list.length === 0) {
        table.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    // Sort newest first
    const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    const currency = appData.settings.my_currency || 'ر.س';

    sorted.forEach(inv => {
        const client = appData.clients.find(c => c.id === inv.clientId);
        const typeBadge = getDocTypeBadgeHtml(inv.type);
        const statusBadge = getPaymentStatusBadgeHtml(inv);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${inv.docNum}</strong></td>
            <td>${typeBadge}</td>
            <td>${client ? client.name : '-'}</td>
            <td>${inv.date}</td>
            <td>${inv.grandTotal.toFixed(2)} ${currency}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="previewInvoice('${inv.id}')" title="معاينة وطباعة"><i class="fas fa-print"></i></button>
                ${inv.type === 'quote' ? 
                    `<button class="btn btn-sm btn-primary" onclick="convertToInvoice('${inv.id}')" title="تحويل لفاتورة إلكترونية"><i class="fas fa-file-invoice"></i></button>` : 
                    `<button class="btn btn-sm btn-outline" onclick="editPayment('${inv.id}')" title="تعديل الدفع"><i class="fas fa-credit-card"></i></button>`
                }
                <button class="btn btn-sm btn-outline" onclick="duplicateInvoice('${inv.id}')" title="نسخ وتكرار"><i class="fas fa-copy"></i></button>
                <button class="btn btn-sm btn-outline btn-danger" onclick="deleteInvoice('${inv.id}')" title="حذف"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getDocTypeBadgeHtml(type) {
    if (type === 'quote') return '<span class="badge badge-quote">عرض سعر</span>';
    if (type === 'invoice') return '<span class="badge badge-invoice">فاتورة إلكترونية</span>';
    if (type === 'maintenance') return '<span class="badge badge-maintenance">فاتورة صيانة</span>';
    return '-';
}

function getPaymentStatusBadgeHtml(inv) {
    if (inv.type === 'quote') return '<span class="badge badge-quote">صالح للمعاينة</span>';
    if (inv.isPaid || inv.paymentStatus === 'paid') return '<span class="badge badge-paid">مدفوعة بالكامل</span>';
    if (inv.paymentStatus === 'partial') return '<span class="badge badge-partial">مدفوع جزئياً</span>';
    return '<span class="badge badge-unpaid">غير مدفوعة</span>';
}

function deleteInvoice(id) {
    if (confirm('هل أنت متأكد من حذف هذا المستند نهائياً؟')) {
        appData.invoices = appData.invoices.filter(i => i.id !== id);
        saveData();
    }
}

// Document Duplication feature
window.duplicateInvoice = function (id) {
    const inv = appData.invoices.find(i => i.id === id);
    if (!inv) return;

    if (confirm('هل ترغب في تكرار ونسخ هذا المستند بالكامل؟')) {
        const nextDocNum = getNextDocNumStr(inv.type);
        const duplicated = {
            ...JSON.parse(JSON.stringify(inv)),
            id: generateId(),
            docNum: nextDocNum,
            date: new Date().toISOString().split('T')[0] // today's date
        };
        
        // Remove linked quote properties
        if (duplicated.quoteId) delete duplicated.quoteId;

        appData.invoices.push(duplicated);
        saveData();
        alert(`تم تكرار المستند بنجاح بالرقم الجديد #${nextDocNum}`);
    }
};

window.convertToInvoice = function (id) {
    const inv = appData.invoices.find(i => i.id === id);
    if (!inv) return;

    openModal('invoiceModal');
    
    // Hydrate form
    document.getElementById('invType').value = 'invoice';
    document.getElementById('invClientSelect').value = inv.clientId;
    document.getElementById('invDate').value = new Date().toISOString().split('T')[0];
    
    currentInvoiceItems = JSON.parse(JSON.stringify(inv.items));
    renderInvoiceItemsTable();

    document.getElementById('invLocalNotes').value = inv.notes || '';
    document.getElementById('invNextMaintenanceDate').value = '';

    document.getElementById('invHasExpiry').checked = false;
    document.getElementById('invExpiryDays').disabled = true;

    // Trigger visual updates
    updateInvoiceBuilderType('invoice');
    
    // Set conversion state
    const btn = document.getElementById('saveInvoiceBtn');
    btn.setAttribute('data-converting', id); // Link quote ID
};

window.editPayment = function (id) {
    const inv = appData.invoices.find(i => i.id === id);
    if (!inv) return;

    openModal('invoiceModal');

    document.getElementById('invType').value = inv.type || 'invoice';
    document.getElementById('invClientSelect').value = inv.clientId;
    document.getElementById('invDate').value = inv.date;

    currentInvoiceItems = JSON.parse(JSON.stringify(inv.items));
    renderInvoiceItemsTable();

    document.getElementById('invLocalNotes').value = inv.notes || '';
    document.getElementById('invNextMaintenanceDate').value = inv.nextMaintenanceDate || '';
    document.getElementById('invPaymentStatus').value = inv.paymentStatus || 'unpaid';

    if (inv.paymentStatus === 'partial') {
        document.getElementById('invAmountPaidGrp').style.display = 'block';
        document.getElementById('invAmountPaid').value = inv.amountPaid || 0;
    } else {
        document.getElementById('invAmountPaidGrp').style.display = 'none';
        document.getElementById('invAmountPaid').value = '';
    }

    // Trigger visual adaptation
    updateInvoiceBuilderType(inv.type, true, inv.docNum);
    
    const btn = document.getElementById('saveInvoiceBtn');
    btn.setAttribute('data-existing-id', id);
};

// --- Dashboard Analytics calculations ---
function updateDashboardAnalytics() {
    const invoices = appData.invoices;
    const currency = appData.settings.my_currency || 'ر.س';
    
    let totalSales = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let docCounts = invoices.length;
    
    invoices.forEach(inv => {
        // Exclude quotations from financial sales analytics (since they are price estimates, not orders)
        if (inv.type !== 'quote') {
            totalSales += inv.grandTotal;
            if (inv.paymentStatus === 'paid') {
                totalPaid += inv.grandTotal;
            } else if (inv.paymentStatus === 'partial') {
                totalPaid += (inv.amountPaid || 0);
                totalRemaining += (inv.grandTotal - (inv.amountPaid || 0));
            } else {
                totalRemaining += inv.grandTotal;
            }
        }
    });
    
    // Update labels in DOM
    document.getElementById('stat_total_sales').innerText = totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
    document.getElementById('stat_total_paid').innerText = totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
    document.getElementById('stat_total_outstanding').innerText = totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
    document.getElementById('stat_doc_counts').innerText = docCounts;
    
    // Progress Bar
    let progressPercent = 0;
    if (totalSales > 0) {
        progressPercent = Math.round((totalPaid / totalSales) * 100);
    }
    const progressBar = document.getElementById('collection_progress_bar');
    if (progressBar) progressBar.style.width = progressPercent + '%';
    
    const progressText = document.getElementById('collection_rate_text');
    if (progressText) progressText.innerText = `تم تحصيل ${progressPercent}% من إجمالي المبيعات المفوترة`;
    
    renderRecentInvoicesTable();
}

function renderRecentInvoicesTable() {
    const tbody = document.querySelector('#recent-invoices-table tbody');
    const emptyState = document.getElementById('recent-empty');
    const table = document.getElementById('recent-invoices-table');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const invoices = appData.invoices;
    if (invoices.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (table) table.style.display = 'none';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    if (table) table.style.display = 'table';
    
    // Sort and take latest 5
    const recent = [...invoices]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
        
    const currency = appData.settings.my_currency || 'ر.س';

    recent.forEach(inv => {
        const client = appData.clients.find(c => c.id === inv.clientId);
        const typeBadge = getDocTypeBadgeHtml(inv.type);
        const statusBadge = getPaymentStatusBadgeHtml(inv);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>#${inv.docNum}</strong></td>
            <td>${typeBadge}</td>
            <td>${client ? client.name : '-'}</td>
            <td>${inv.date}</td>
            <td>${inv.grandTotal.toFixed(2)} ${currency}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Preview & Print Rendering ---
document.getElementById('invPreviewBtn').addEventListener('click', () => {
    // Generate an in-memory temp invoice object from builder fields
    const clientId = document.getElementById('invClientSelect').value;
    if (!clientId) { alert('يجب تحديد العميل لمعاينة المستند'); return; }

    const isConverting = document.getElementById('saveInvoiceBtn').getAttribute('data-converting');
    const isExisting = document.getElementById('saveInvoiceBtn').getAttribute('data-existing-id');
    const selectedType = document.getElementById('invType').value;

    let hasExpiry = document.getElementById('invHasExpiry').checked;
    let expiryDays = parseInt(document.getElementById('invExpiryDays').value) || null;

    const totals = calculateCurrentTotals();

    let tempDocNum = document.getElementById('invDocNum').value.trim() || '---';

    const tempInvoice = {
        docNum: tempDocNum,
        type: selectedType,
        clientId,
        date: document.getElementById('invDate').value,
        expiryDays: (selectedType === 'quote' && hasExpiry) ? expiryDays : null,
        items: JSON.parse(JSON.stringify(currentInvoiceItems)),
        notes: document.getElementById('invLocalNotes').value.trim(),
        ...totals
    };

    if (selectedType === 'maintenance' && document.getElementById('invNextMaintenanceDate').value) {
        tempInvoice.nextMaintenanceDate = document.getElementById('invNextMaintenanceDate').value;
    } else {
        tempInvoice.nextMaintenanceDate = '';
    }

    if (selectedType !== 'quote') {
        const payStatus = document.getElementById('invPaymentStatus').value;
        tempInvoice.paymentStatus = payStatus;
        if (payStatus === 'paid') {
            tempInvoice.amountPaid = totals.grandTotal;
            tempInvoice.isPaid = true;
        } else if (payStatus === 'partial') {
            tempInvoice.amountPaid = parseFloat(document.getElementById('invAmountPaid').value) || 0;
            tempInvoice.isPaid = false;
        } else {
            tempInvoice.amountPaid = 0;
            tempInvoice.isPaid = false;
        }
    }

    window.currentPreviewDoc = tempInvoice;
    renderPrintLayout(tempInvoice, document.getElementById('preview_lang').value);
    document.getElementById('pdfOverlay').style.display = 'flex';
});

window.previewInvoice = function (id) {
    const inv = appData.invoices.find(i => i.id === id);
    if (inv) {
        window.currentPreviewDoc = inv;
        renderPrintLayout(inv, document.getElementById('preview_lang').value);
        document.getElementById('pdfOverlay').style.display = 'flex';
    }
};

window.closeDocPreview = function () {
    document.getElementById('pdfOverlay').style.display = 'none';
};

function renderPrintLayout(inv, lang = 'ar') {
    const s = appData.settings;
    const client = appData.clients.find(c => c.id === inv.clientId) || {};
    const currency = s.my_currency || 'ر.س';

    // Set direction and text alignment
    const layout = document.getElementById('printLayout');
    layout.dir = lang === 'ar' ? 'rtl' : 'ltr';
    layout.style.textAlign = lang === 'ar' ? 'right' : 'left';

    const translations = {
        ar: {
            quote: 'عرض سعر',
            invoice: 'فاتورة إلكترونية',
            maintenance: 'فاتورة صيانة',
            docNumLabel: inv.type === 'quote' ? 'رقم العرض:' : 'رقم الفاتورة:',
            date: 'التاريخ:',
            expiry: 'تاريخ الصلاحية:',
            clientTitle: 'المستلم:',
            taxNum: 'الرقم الضريبي:',
            itemNo: '#',
            itemName: 'البند',
            qty: 'الكمية',
            price: 'سعر القطعة',
            discount: 'الخصم',
            total: 'الإجمالي',
            subtotal: 'المجموع:',
            totalDiscount: 'إجمالي الخصم:',
            grandTotal: 'المبلغ المطلوب:',
            paid: 'المبلغ المدفوع:',
            remaining: 'المبلغ المتبقي:',
            fullyPaid: '(مدفوع بالكامل)',
            notesTitle: 'الملاحظات والشروط:',
            nextMaint: 'موعد الصيانة القادم:',
            bank: 'الحساب البنكي:',
            iban: 'الآيبان:',
            signature: 'التوقيع والختم:',
            stamp: 'مدفوعة'
        },
        en: {
            quote: 'Price Quotation',
            invoice: 'Electronic Invoice',
            maintenance: 'Maintenance Invoice',
            docNumLabel: inv.type === 'quote' ? 'Quotation No:' : 'Invoice No:',
            date: 'Date:',
            expiry: 'Expiry Date:',
            clientTitle: 'Customer / Recipient:',
            taxNum: 'VAT Registration No:',
            itemNo: '#',
            itemName: 'Item & Description',
            qty: 'Qty',
            price: 'Unit Price',
            discount: 'Discount',
            total: 'Total',
            subtotal: 'Subtotal:',
            totalDiscount: 'Discount Total:',
            grandTotal: 'Total Payable:',
            paid: 'Amount Paid:',
            remaining: 'Balance Due:',
            fullyPaid: '(Fully Paid)',
            notesTitle: 'Terms & Notes:',
            nextMaint: 'Next Maintenance:',
            bank: 'Bank Details:',
            iban: 'IBAN:',
            signature: 'Authorized Seal/Signature:',
            stamp: 'PAID'
        }
    };

    const t = translations[lang];

    // Header My Info
    document.getElementById('pMyName').innerText = s.my_name || '';
    document.getElementById('pMyAddress').innerText = s.my_address || '';
    document.getElementById('pMyPhone').innerText = s.my_phone || '';

    // Logo
    const pLogo = document.getElementById('pLogo');
    if (s.logo) {
        pLogo.src = s.logo;
        pLogo.style.display = 'block';
    } else {
        pLogo.style.display = 'none';
    }

    // Header Doc Info
    document.getElementById('pDocNum').innerText = inv.docNum;
    document.getElementById('pDocDate').innerText = inv.date;

    const expiryWrapper = document.getElementById('pDocExpiryWrapper');
    if (inv.expiryDays && inv.type === 'quote') {
        const expiryDate = new Date(inv.date);
        expiryDate.setDate(expiryDate.getDate() + inv.expiryDays);
        document.getElementById('pDocExpiry').innerText = expiryDate.toISOString().split('T')[0];
        expiryWrapper.style.display = 'inline';
        expiryWrapper.querySelector('strong').innerText = t.expiry;
    } else {
        expiryWrapper.style.display = 'none';
    }

    // Title and Labels
    let docTypeTitle = t.invoice;
    if (inv.type === 'quote') docTypeTitle = t.quote;
    if (inv.type === 'maintenance') docTypeTitle = t.maintenance;

    document.getElementById('pDocTitle').innerText = docTypeTitle;
    document.getElementById('pDocNumLabel').innerText = t.docNumLabel;
    document.getElementById('pDocDate').previousElementSibling.innerText = t.date;

    // Client Info Block
    let cHtml = `<h4 style="margin:0 0 5px 0;">${t.clientTitle}</h4>`;
    cHtml += `<span style="font-size: 14px; font-weight: 700; color: #0f172a;">${client.name || ''}</span><br>`;
    if (client.address) cHtml += `${client.address}<br>`;
    cHtml += `${client.city || ''} ${client.neighborhood ? '- ' + client.neighborhood : ''} ${client.zip || ''}<br>`;
    if (client.taxNum) cHtml += `<span style="color: #64748b; font-size: 12px;">${t.taxNum} ${client.taxNum}</span>`;
    document.getElementById('pClientDetails').innerHTML = cHtml;

    // Table Header
    const thead = document.querySelector('.print-table thead tr');
    thead.innerHTML = `
        <th style="width:5%">${t.itemNo}</th>
        <th style="width:40%">${t.itemName}</th>
        <th style="width:10%">${t.qty}</th>
        <th style="width:15%">${t.price}</th>
        <th style="width:15%">${t.discount}</th>
        <th style="width:15%">${t.total}</th>
    `;

    // Table Content
    const tbody = document.getElementById('pTableBody');
    tbody.innerHTML = '';
    inv.items.forEach((item, idx) => {
        const itemTotal = (item.price * item.qty) - (item.discount || 0);
        tbody.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td class="item-cell">
                    <strong>${item.name}</strong>
                    ${item.desc ? `<span>${item.desc}</span>` : ''}
                </td>
                <td>${item.qty} ${item.unit || 'حبة'}</td>
                <td>${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}</td>
                <td>${item.discount > 0 ? item.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency : '-'}</td>
                <td>${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}</td>
            </tr>
        `;
    });

    // Summary Labels
    document.getElementById('pSubtotal').previousElementSibling.innerText = t.subtotal;
    document.getElementById('pDiscount').previousElementSibling.innerText = t.totalDiscount;
    document.getElementById('pGrandTotal').previousElementSibling.innerText = t.grandTotal;
    document.getElementById('pPaid').previousElementSibling.innerText = t.paid;
    document.getElementById('pRemaining').previousElementSibling.innerText = t.remaining;

    // Summary Values
    document.getElementById('pSubtotal').innerText = inv.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
    document.getElementById('pDiscount').innerText = inv.totalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
    document.getElementById('pGrandTotal').innerText = inv.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;

    // Payments rows
    const p1 = document.getElementById('pPaymentRow1');
    const p2 = document.getElementById('pPaymentRow2');
    const stamp = document.getElementById('pStampPaid');

    p1.style.display = 'none';
    p2.style.display = 'none';
    stamp.style.display = 'none';
    stamp.innerText = t.stamp;

    if (inv.type !== 'quote') {
        if (inv.paymentStatus === 'paid') {
            p1.style.display = 'table-row';
            document.getElementById('pPaid').innerText = inv.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency + ' ' + t.fullyPaid;
            stamp.style.display = 'block';
        } else if (inv.paymentStatus === 'partial') {
            p1.style.display = 'table-row';
            p2.style.display = 'table-row';
            document.getElementById('pPaid').innerText = inv.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
            document.getElementById('pRemaining').innerText = (inv.grandTotal - inv.amountPaid).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
        } else {
            p1.style.display = 'table-row';
            document.getElementById('pPaid').innerText = '0.00' + ' ' + currency;
            p2.style.display = 'table-row';
            document.getElementById('pRemaining').innerText = inv.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
        }
    }

    // Footer Notes
    const notesSec = document.querySelector('.print-notes-section');
    notesSec.querySelector('strong').innerText = t.notesTitle;
    document.getElementById('pNotesText').innerText = inv.notes || '';
    if (inv.type === 'quote') {
        document.getElementById('pDefaultNotesText').innerText = s.default_quote_notes || '';
    } else {
        document.getElementById('pDefaultNotesText').innerText = s.default_invoice_notes || '';
    }

    // Maintenance section
    const nextMaintSection = document.getElementById('pNextMaintenanceSection');
    if (inv.type === 'maintenance' && inv.nextMaintenanceDate) {
        nextMaintSection.style.display = 'block';
        nextMaintSection.querySelector('strong').innerText = t.nextMaint;
        document.getElementById('pNextMaintenanceDate').innerText = inv.nextMaintenanceDate;
    } else {
        nextMaintSection.style.display = 'none';
    }

    // Bank Account details
    const bankSection = document.getElementById('pBankSection');
    if (s.show_bank && inv.type === 'quote') {
        bankSection.style.display = 'block';
        bankSection.querySelector('div').innerHTML = `
            <strong>${t.bank}</strong> <span id="pBankName">${s.my_bank || ''}</span><br>
            <strong>${t.iban}</strong> <span id="pBankIban" dir="ltr">${s.my_iban || ''}</span>
        `;
        const barcodeImgEl = document.getElementById('pBankBarcodeImg');
        if (s.show_barcode && s.iban_barcode) {
            barcodeImgEl.src = s.iban_barcode;
            barcodeImgEl.style.display = 'block';
        } else {
            barcodeImgEl.style.display = 'none';
        }
    } else {
        bankSection.style.display = 'none';
    }

    // Signature Block
    const sigSection = document.getElementById('pSignatureSection');
    const sigPlaceholder = document.getElementById('pSignaturePlaceholder');
    sigSection.querySelector('div').innerText = t.signature;
    sigPlaceholder.querySelector('div').innerText = t.signature;

    if (s.signature) {
        document.getElementById('pSignatureImg').src = s.signature;
        sigSection.style.display = 'block';
        if (sigPlaceholder) sigPlaceholder.style.display = 'none';
    } else {
        sigSection.style.display = 'none';
        if (sigPlaceholder) sigPlaceholder.style.display = 'block';
    }

    // Clone into modal preview container
    const previewContainer = document.getElementById('pdfPreviewContainer');
    previewContainer.innerHTML = '';

    const printEl = document.getElementById('printLayout').cloneNode(true);
    printEl.id = 'tempPrintLayout';
    printEl.classList.remove('no-screen');
    previewContainer.appendChild(printEl);
}

// PDF Generate Actions
document.getElementById('pdfPrintBtn').addEventListener('click', () => {
    const element = document.getElementById('printPage');
    const title = document.getElementById('pDocTitle').innerText;
    const num = document.getElementById('pDocNum').innerText;
    const filename = `${title}_${num}.pdf`;

    const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    const layout = document.getElementById('printLayout');
    layout.classList.remove('no-screen'); // Temporarily show

    html2pdf().set(opt).from(element).save().then(() => {
        layout.classList.add('no-screen'); // Clean up
    });
});
