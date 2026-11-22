/* ==========================================
   إدارة المستخدمين والصلاحيات
   - كوليكشن: users
   - يعتمد على: tabs.js (switchMainTab, switchSubTab)
   - ضيف في index.html بعد couriers.js:  <script src="/users.js"></script>
   ========================================== */

const USERS_CFG = { collection: 'users', sessionKey: 'currentUserId' };
const PBKDF2_ITERATIONS = 150000;

// ---------- تعريف التابات والتفاصيل ----------
// {h: '...'} = عنوان فرعي داخل المجموعة
const PERM_TABS = [
    {
        n: 1, label: 'الطلبات', details: [
            { k: 'orders.add', l: 'إضافة طلب جديد' },
            { k: 'orders.import', l: 'إضافة من Excel' },
            { k: 'orders.export', l: 'تحميل Excel' },
            { k: 'orders.closeDay', l: 'تقفيل اليوم' }
        ]
    },
    { n: 2, label: 'التقسيم', details: [{ k: 'zoning.assign', l: 'تعيين الأوردرات للمناطق' }] },
    { n: 3, label: 'التقارير', details: [] },
    {
        n: 4, label: 'تقفيل مرتجعات', details: [
            { k: 'closing.returns', l: 'استلام كل المرتجعات' },
            { k: 'closing.cash', l: 'استلام كل الفلوس' }
        ]
    },
    {
        n: 5, label: 'مراجعه', details: [
            { k: 'review.edit', l: 'زر التعديل' },
            { k: 'review.pdf', l: 'تقرير PDF' },
            { k: 'review.excelOffice', l: 'Excel للمكتب' },
            { k: 'review.excelAll', l: 'Excel كل المكاتب' }
        ]
    },
    { n: 6, label: 'التطبيقات', details: [] },
    {
        n: 7, label: 'الاعدادات', details: [
            { h: 'التبويبات الفرعية' },
            { k: 'settings.sub.1', l: 'عامة' },
            { k: 'settings.sub.2', l: 'المكاتب' },
            { k: 'settings.sub.3', l: 'المناديب' },
            { k: 'settings.sub.4', l: 'المناطق' },
            { k: 'settings.sub.5', l: 'الحالات' },
            { k: 'settings.sub.6', l: 'الموظفين (CRM)' },
            { k: 'settings.sub.8', l: 'التطبيقات' },
            { h: 'المكاتب / المناطق / الحالات / الموظفين' },
            { k: 'offices.manage', l: 'إضافة وتعديل وحذف المكاتب' },
            { k: 'zones.manage', l: 'إضافة وتعديل وحذف المناطق' },
            { k: 'statuses.manage', l: 'إضافة وتعديل وحذف الحالات' },
            { k: 'staff.manage', l: 'تعيين الموظفين' },
            { h: 'المناديب' },
            { k: 'couriers.add', l: 'إضافة مندوب' },
            { k: 'couriers.status', l: 'إيقاف / تشغيل مندوب' },
            { k: 'couriers.delete', l: 'حذف مندوب' },
            { k: 'couriers.details', l: 'فتح سجل المندوب' },
            { k: 'couriers.edit', l: 'تعديل بيانات المندوب' },
            { k: 'couriers.tab.orders', l: 'تاب الطلبات (في السجل)' },
            { k: 'couriers.tab.ledger', l: 'تاب العهدة والمديونية' },
            { k: 'couriers.ledger.write', l: 'تسجيل عهدة / سداد / حذف حركة' },
            { k: 'couriers.tab.moves', l: 'تاب حركات الأوردرات' },
            { k: 'couriers.tab.log', l: 'تاب سجل الإدارة' }
        ]
    }
];

// ربط كل صلاحية بالعناصر اللي بتتحكم فيها (hide = إخفاء، disable = تعطيل الضغط)
const PERM_RULES = [
    { perm: 'orders.add', sel: `[onclick^="addNewBlankRowAndFocus"]` },
    { perm: 'orders.import', sel: `label[for="import-excel"]` },
    { perm: 'orders.export', sel: `[onclick^="exportToExcel"]` },
    { perm: 'orders.closeDay', sel: `[onclick="closeDay()"]` },
    { perm: 'zoning.assign', sel: `#btn-submit-code` },
    { perm: 'closing.returns', sel: `[onclick*="clReceiveAllVisible('return')"]` },
    { perm: 'closing.cash', sel: `[onclick*="clReceiveAllVisible('cash')"]` },
    { perm: 'review.edit', sel: `#review-edit-btn` },
    { perm: 'review.pdf', sel: `[onclick^="reviewExportPDF"]` },
    { perm: 'review.excelOffice', sel: `[onclick^="reviewExportSelectedOffice"]` },
    { perm: 'review.excelAll', sel: `[onclick^="reviewExportAllOffices"]` },
    { perm: 'offices.manage', sel: `[onclick^="openAddOfficeModal"],[onclick^="openEditOfficeModal"],[onclick^="deleteOffice"],[onclick^="toggleOfficeStatus"]` },
    { perm: 'zones.manage', sel: `[onclick^="addNewZoneRow"],[onclick^="openEditZoneModal"],[onclick^="deleteZone"],[onclick^="toggleZoneStatus"]` },
    { perm: 'statuses.manage', sel: `[onclick^="openAddStatusModal"],[onclick^="openEditStatusModal"],[onclick^="deleteStatus"]` },
    { perm: 'staff.manage', sel: `[onclick^="addNewStaffRow"]` },
    { perm: 'couriers.add', sel: `[onclick^="addNewCourierRow"]` },
    { perm: 'couriers.status', sel: `[onclick^="toggleCourierStatus"]` },
    { perm: 'couriers.delete', sel: `[onclick^="deleteCourier("]` },
    { perm: 'couriers.details', sel: `[onclick^="openCourierHistory"]`, mode: 'disable' },
    { perm: 'couriers.edit', sel: `[onclick^="openEditCourierModal(courierHistoryView"]` },
    { perm: 'couriers.tab.orders', sel: `#courier-tab-orders` },
    { perm: 'couriers.tab.ledger', sel: `#courier-tab-ledger` },
    { perm: 'couriers.tab.moves', sel: `#courier-tab-moves` },
    { perm: 'couriers.tab.log', sel: `#courier-tab-log` },
    { perm: 'couriers.ledger.write', sel: `[onclick^="setCourierLedgerPanel"],[onclick^="payCourierOrder"],[onclick^="deleteCourierLedgerEntry"]` }
];

const PERM_TAB_OF = {};      // key -> tab number
let PERM_TOTAL = 0;
PERM_TABS.forEach(t => t.details.forEach(d => { if (d.k) { PERM_TAB_OF[d.k] = t.n; PERM_TOTAL++; } }));

let usersData = [];
let usersLoaded = false;
let currentUser = null;
let usersLastTabsSig = '';

// ---------- أدوات ----------
const uEsc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uDigits = (s) => String(s ?? '').replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x0660).replace(/\D/g, '');
const uClean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
function uSalt() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

const uHasSubtle = () => !!(window.crypto && window.crypto.subtle);
const uToHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

/*
  algo:
    'pbkdf2'  -> PBKDF2-SHA256 (الأقوى، الافتراضي للحسابات الجديدة)
    غير كده   -> الطريقة القديمة (SHA-256 + salt) عشان الحسابات الحالية تفضل شغالة
*/
async function uHash(pw, salt, algo) {
    const enc = new TextEncoder();
    if (algo === 'pbkdf2' && uHasSubtle()) {
        const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
            key, 256);
        return uToHex(bits);
    }
    const str = salt + '::' + pw;
    if (uHasSubtle()) {
        return uToHex(await crypto.subtle.digest('SHA-256', enc.encode(str)));
    }
    // احتياطي ضعيف لو الصفحة مش على HTTPS / localhost
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'f' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// ---------- منطق الصلاحيات ----------
// الحماية بتشتغل بس لو فيه مدير واحد على الأقل (عشان ماتتقفلش على نفسك أول مرة)
function userGateOn() { return usersData.some(u => u.isAdmin && u.active !== false && u.passHash); }

function resolveCurrentUser() {
    const id = localStorage.getItem(USERS_CFG.sessionKey);
    currentUser = usersData.find(u => u.id === id && u.active !== false) || null;
}

function userIsAdmin() { return !userGateOn() || !!currentUser?.isAdmin; }

function userCanTab(n) {
    if (!userGateOn()) return true;
    if (!currentUser) return false;
    return currentUser.isAdmin || (currentUser.tabs || []).includes(n);
}

function userCan(key) {
    if (!userGateOn()) return true;
    if (!currentUser) return false;
    if (currentUser.isAdmin) return true;
    return (currentUser.tabs || []).includes(PERM_TAB_OF[key]) && (currentUser.perms || []).includes(key);
}
window.userCan = userCan;
window.userCanTab = userCanTab;

// ---------- تطبيق الصلاحيات على الواجهة ----------
function setPermHidden(el, deny, mode) {
    if (mode === 'disable') {
        el.style.pointerEvents = deny ? 'none' : '';
        if (deny) el.title = 'غير مسموح';
    } else if (deny) {
        el.style.setProperty('display', 'none', 'important');
    } else {
        el.style.removeProperty('display');
    }
}

function applyUserPermissions() {
    if (!usersLoaded) return;

    PERM_RULES.forEach(r => {
        const deny = !userCan(r.perm);
        document.querySelectorAll(r.sel).forEach(el => setPermHidden(el, deny, r.mode));
    });

    // التابات الرئيسية
    const allowedTabs = [];
    for (let n = 1; n <= 7; n++) {
        const ok = userCanTab(n);
        if (ok) allowedTabs.push(n);
        const b = document.getElementById('main-btn-' + n);
        if (b) setPermHidden(b, !ok);
    }

    // التبويبات الفرعية للإعدادات
    const allowedSubs = [];
    for (let n = 1; n <= 8; n++) {
        const ok = n === 7 ? userIsAdmin() : userCan('settings.sub.' + n);
        if (ok) allowedSubs.push(n);
        const b = document.getElementById('sub-btn-4-' + n);
        if (b) setPermHidden(b, !ok);
    }

    // لو التاب الحالي اتقفل، أو الأزرار اتغيرت: ننقل لأول تاب مسموح (ده كمان بيظبط مؤشر التاب)
    const sig = allowedTabs.join(',');
    const visibleMain = [1, 2, 3, 4, 5, 6, 7].find(n => {
        const p = document.getElementById('main-panel-' + n);
        return p && getComputedStyle(p).display !== 'none';
    });
    if (typeof switchMainTab === 'function' && allowedTabs.length &&
        (sig !== usersLastTabsSig || (visibleMain && !allowedTabs.includes(visibleMain)))) {
        usersLastTabsSig = sig;
        switchMainTab(allowedTabs.includes(visibleMain) ? visibleMain : allowedTabs[0]);
    }

    const visibleSub = [1, 2, 3, 4, 5, 6, 7, 8].find(n => {
        const p = document.getElementById('sub-panel-4-' + n);
        return p && getComputedStyle(p).display !== 'none';
    });
    if (typeof switchSubTab === 'function' && allowedSubs.length && visibleSub && !allowedSubs.includes(visibleSub)) {
        switchSubTab(4, allowedSubs[0]);
    }

    renderUserSessionChip();
}

// أي عناصر بتتبني ديناميكياً (جداول، نوافذ) بنطبق عليها الصلاحيات تاني
let usersApplyTimer = null;
function startUsersObserver() {
    new MutationObserver(() => {
        clearTimeout(usersApplyTimer);
        usersApplyTimer = setTimeout(applyUserPermissions, 80);
    }).observe(document.body, { childList: true, subtree: true });
}

// ---------- تسجيل الدخول ----------
function ensureLoginOverlay() {
    if (document.getElementById('user-login-overlay')) return;
    const w = document.createElement('div');
    w.innerHTML = `
    <div id="user-login-overlay" class="fixed inset-0 bg-slate-900 hidden items-center justify-center z-[20000] p-4" dir="rtl">
        <form onsubmit="handleUserLogin(event)" autocomplete="off" class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div class="text-center">
                <div class="text-3xl mb-1">🔐</div>
                <h3 class="text-base font-bold text-slate-800">تسجيل الدخول</h3>
                <p class="text-[11px] text-slate-400 mt-0.5">ادخل رقم الموبايل وكلمة المرور</p>
            </div>
            <input type="tel" id="login-phone" required placeholder="رقم الموبايل"
                class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500">
            <input type="password" id="login-pass" required placeholder="كلمة المرور" autocomplete="current-password"
                class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500">
            <p id="login-error" class="hidden text-[11px] font-semibold text-rose-600"></p>
            <button type="submit" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors">دخول</button>
        </form>
    </div>`;
    document.body.appendChild(w.firstElementChild);
}

async function handleUserLogin(e) {
    e.preventDefault();
    const phone = uDigits(document.getElementById('login-phone').value);
    const pass = document.getElementById('login-pass').value;
    const u = usersData.find(x => x.active !== false && x.passHash && uDigits(x.phone) === phone);
    const ok = u && (await uHash(pass, u.passSalt || '', u.passAlgo)) === u.passHash;
    const err = document.getElementById('login-error');
    if (!ok) {
        err.textContent = 'البيانات غير صحيحة أو الحساب موقوف';
        err.classList.remove('hidden');
        return;
    }
    err.classList.add('hidden');
    localStorage.setItem(USERS_CFG.sessionKey, u.id);
    document.getElementById('login-pass').value = '';
    resolveCurrentUser();
    renderUsersGate();
    applyUserPermissions();

    // ترقية تلقائية: الحساب القديم (SHA-256 بسيط) يتحول لـ PBKDF2 عند أول دخول ناجح
    if (u.passAlgo !== 'pbkdf2' && uHasSubtle() && window.db) {
        try {
            const passSalt = uSalt();
            const passHash = await uHash(pass, passSalt, 'pbkdf2');
            await window.db.collection(USERS_CFG.collection).doc(u.id)
                .update({ passSalt, passHash, passAlgo: 'pbkdf2' });
        } catch (er) { console.warn('تعذر ترقية الهاش:', er); }
    }
}

function renderUsersGate() {
    ensureLoginOverlay();
    const ov = document.getElementById('user-login-overlay');
    const show = usersLoaded && userGateOn() && !currentUser;
    ov.classList.toggle('hidden', !show);
    ov.classList.toggle('flex', show);
}

function userLogout() {
    localStorage.removeItem(USERS_CFG.sessionKey);
    currentUser = null;
    renderUsersGate();
    applyUserPermissions();
}

function renderUserSessionChip() {
    const host = document.getElementById('header-company-name')?.parentElement;
    if (!host) return;
    let chip = document.getElementById('user-session-chip');
    if (!userGateOn() || !currentUser) { chip?.remove(); return; }
    if (!chip) {
        chip = document.createElement('div');
        chip.id = 'user-session-chip';
        chip.className = 'text-[11px] text-emerald-100 flex items-center gap-2 whitespace-nowrap';
        host.appendChild(chip);
    }
    // نكتب الـ HTML بس لو اتغير، عشان الـ MutationObserver ماينادي نفسه في دايرة
    const key = currentUser.id + '|' + currentUser.name;
    if (chip.dataset.key !== key) {
        chip.dataset.key = key;
        chip.innerHTML = `<span>👤 ${uEsc(currentUser.name)}</span>
        <button type="button" onclick="userLogout()" class="underline hover:text-white">خروج</button>`;
    }
}

// ---------- الجدول ----------
function userPermCount(u) {
    if (u.isAdmin) return PERM_TOTAL;
    const tabs = u.tabs || [];
    return (u.perms || []).filter(k => tabs.includes(PERM_TAB_OF[k])).length;
}

function renderUsersTable(data = usersData) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">لا يوجد مستخدمون بعد. أضف أول مدير للنظام لتفعيل الحماية.</td></tr>`;
        return;
    }
    const tabLabel = (n) => PERM_TABS.find(t => t.n === n)?.label || n;

    tbody.innerHTML = data.map(u => {
        const active = u.active !== false;
        const chips = u.isAdmin
            ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">كل التابات</span>`
            : ((u.tabs || []).length
                ? [...u.tabs].sort((a, b) => a - b).map(n => `<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">${uEsc(tabLabel(n))}</span>`).join(' ')
                : `<span class="text-slate-400">—</span>`);
        const cnt = userPermCount(u);
        return `
        <tr class="hover:bg-slate-50/60 transition-colors ${!active ? 'bg-slate-50/60' : ''}">
            <td class="p-3.5 font-semibold text-slate-800">${uEsc(u.name)}
                ${u.isAdmin ? `<span class="mr-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">مدير</span>` : ''}</td>
            <td class="p-3.5 font-mono text-slate-600" dir="ltr">${uEsc(u.phone)}</td>
            <td class="p-3.5 text-slate-500">${u.passHash ? '••••••••' : '<span class="text-amber-600 font-semibold">غير محددة</span>'}</td>
            <td class="p-3.5"><div class="flex flex-wrap gap-1 justify-center">${chips}</div></td>
            <td class="p-3.5 text-center">
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${u.isAdmin || cnt ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                    ${u.isAdmin ? 'كل الصلاحيات' : cnt + ' من ' + PERM_TOTAL}</span>
            </td>
            <td class="p-3.5 text-center">
                ${active
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> نشط</span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> موقوف</span>`}
            </td>
            <td class="p-3.5 text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" onclick="toggleUserStatus('${u.id}')"
                        class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${active
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'}">${active ? 'إيقاف' : 'تشغيل'}</button>
                    <button type="button" onclick="openEditUserModal('${u.id}')" title="تعديل"
                        class="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" onclick="deleteUser('${u.id}')" title="حذف"
                        class="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterUsersTable() {
    const q = uClean(document.getElementById('users-search-input')?.value || '').toLowerCase();
    const qd = uDigits(q);
    const list = q ? usersData.filter(u =>
        String(u.name || '').toLowerCase().includes(q) ||
        (qd && uDigits(u.phone).includes(qd))) : usersData;
    renderUsersTable([...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar')));
}

// ---------- النافذة ----------
function buildPermPicker() {
    const box = document.getElementById('user-modal-perms');
    if (!box) return;
    box.innerHTML = PERM_TABS.map(t => `
    <div class="border border-slate-200 rounded-xl overflow-hidden" data-tab-group="${t.n}">
        <label class="flex items-center gap-2 px-3 py-2 bg-slate-50 cursor-pointer text-xs font-bold text-slate-700">
            <input type="checkbox" class="u-tab w-4 h-4 accent-emerald-600" value="${t.n}" onchange="userPickerSync()">
            تاب: ${uEsc(t.label)}
        </label>
        ${t.details.length ? `
        <div class="u-details grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 p-3 transition-opacity">
            ${t.details.map(d => d.h
        ? `<div class="sm:col-span-2 text-[11px] font-bold text-slate-400 pt-1">${uEsc(d.h)}</div>`
        : `<label class="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input type="checkbox" class="u-perm w-4 h-4 accent-blue-600" value="${d.k}"> ${uEsc(d.l)}</label>`).join('')}
        </div>` : ''}
    </div>`).join('');
}

function userPickerSync() {
    document.querySelectorAll('#user-modal-perms [data-tab-group]').forEach(g => {
        const on = g.querySelector('.u-tab').checked;
        const d = g.querySelector('.u-details');
        if (d) { d.classList.toggle('opacity-40', !on); d.classList.toggle('pointer-events-none', !on); }
    });
}

function userAdminToggle() {
    const admin = document.getElementById('user-modal-admin').checked;
    document.getElementById('user-modal-perms-wrap').classList.toggle('hidden', admin);
}

function userPickerAll(v) {
    document.querySelectorAll('#user-modal-perms input[type=checkbox]').forEach(c => { c.checked = v; });
    userPickerSync();
}

function ensureUserModal() {
    if (document.getElementById('user-modal')) return;
    const inp = 'w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500';
    const lbl = 'block text-xs font-semibold text-slate-600 mb-1';
    const w = document.createElement('div');
    w.innerHTML = `
    <div id="user-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center z-[10000] p-4" dir="rtl">
        <div class="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh]">
            <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h4 id="user-modal-title" class="text-base font-bold text-slate-800">إضافة مستخدم</h4>
                <button type="button" onclick="closeUserModal()" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">✕</button>
            </div>
            <form id="user-modal-form" onsubmit="handleUserSubmit(event)" class="p-6 space-y-4 overflow-y-auto" autocomplete="off">
                <input type="hidden" id="user-modal-id">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><label class="${lbl}">اسم المستخدم</label><input type="text" id="user-modal-name" required class="${inp}"></div>
                    <div><label class="${lbl}">رقم الموبايل</label><input type="tel" id="user-modal-phone" required placeholder="01xxxxxxxxx" class="${inp}"></div>
                    <div><label class="${lbl}" id="user-modal-pass-label">كلمة المرور</label><input type="password" id="user-modal-pass" autocomplete="new-password" class="${inp}"></div>
                </div>

                <label class="flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 cursor-pointer">
                    <input type="checkbox" id="user-modal-admin" class="w-4 h-4 accent-indigo-600" onchange="userAdminToggle()">
                    مدير النظام (كل التابات وكل التفاصيل + إدارة المستخدمين)
                </label>

                <div id="user-modal-perms-wrap" class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold text-slate-700">التابات والتفاصيل المسموحة</span>
                        <div class="flex gap-2">
                            <button type="button" onclick="userPickerAll(true)" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600">تحديد الكل</button>
                            <button type="button" onclick="userPickerAll(false)" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600">إلغاء الكل</button>
                        </div>
                    </div>
                    <div id="user-modal-perms" class="space-y-2"></div>
                </div>

                <p id="user-modal-error" class="hidden text-[11px] font-semibold text-rose-600"></p>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button type="button" onclick="closeUserModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold">إلغاء</button>
                    <button type="submit" id="user-modal-save" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50">حفظ المستخدم</button>
                </div>
            </form>
        </div>
    </div>`;
    document.body.appendChild(w.firstElementChild);
    buildPermPicker();
    const m = document.getElementById('user-modal');
    m.addEventListener('click', (e) => { if (e.target === m) closeUserModal(); });
}

function showUserModalError(msg) {
    const el = document.getElementById('user-modal-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function openUserModal(title, u = null) {
    ensureUserModal();
    const set = (id, v) => { document.getElementById(id).value = v ?? ''; };
    document.getElementById('user-modal-title').textContent = title;
    set('user-modal-id', u?.id || '');
    set('user-modal-name', u?.name);
    set('user-modal-phone', u?.phone);
    const pass = document.getElementById('user-modal-pass');
    pass.value = '';
    pass.required = !u?.passHash;
    pass.placeholder = u?.passHash ? 'اتركها فاضية للإبقاء على الحالية' : '4 أحرف على الأقل';
    // أول مستخدم في النظام بيتحدد مدير تلقائياً
    document.getElementById('user-modal-admin').checked = u ? !!u.isAdmin : usersData.length === 0;
    document.querySelectorAll('#user-modal-perms .u-tab').forEach(c => { c.checked = (u?.tabs || []).includes(Number(c.value)); });
    document.querySelectorAll('#user-modal-perms .u-perm').forEach(c => { c.checked = (u?.perms || []).includes(c.value); });
    userPickerSync();
    userAdminToggle();
    document.getElementById('user-modal-error').classList.add('hidden');
    const b = document.getElementById('user-modal-save');
    b.disabled = false;
    b.textContent = 'حفظ المستخدم';
    const m = document.getElementById('user-modal');
    m.classList.remove('hidden');
    m.classList.add('flex');
}

function addNewUserRow() { openUserModal('إضافة مستخدم نظام'); }
function openEditUserModal(id) {
    const u = usersData.find(x => x.id === id);
    if (u) openUserModal('تعديل المستخدم', u);
}
function closeUserModal() {
    const m = document.getElementById('user-modal');
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('flex');
}

// ---------- الحفظ ----------
async function handleUserSubmit(e) {
    e.preventDefault();
    if (!window.db) return;
    const id = document.getElementById('user-modal-id').value;
    const name = uClean(document.getElementById('user-modal-name').value);
    const phone = uDigits(document.getElementById('user-modal-phone').value);
    const pass = document.getElementById('user-modal-pass').value;
    const isAdmin = document.getElementById('user-modal-admin').checked;
    const old = usersData.find(u => u.id === id);

    if (!name) return showUserModalError('اكتب اسم المستخدم');
    if (phone.length < 10) return showUserModalError('رقم الموبايل غير صحيح');
    if (!old?.passHash && !pass) return showUserModalError('اكتب كلمة المرور');
    if (pass && pass.length < 4) return showUserModalError('كلمة المرور لازم تكون 4 أحرف على الأقل');

    const others = usersData.filter(u => u.id !== id);
    if (others.some(u => uDigits(u.phone) === phone)) return showUserModalError('رقم الموبايل ده مسجل لمستخدم آخر');

    const tabs = [...document.querySelectorAll('#user-modal-perms .u-tab:checked')].map(c => Number(c.value));
    const perms = [...document.querySelectorAll('#user-modal-perms .u-perm:checked')]
        .map(c => c.value).filter(k => tabs.includes(PERM_TAB_OF[k]));

    if (!isAdmin && !tabs.length) return showUserModalError('اختار تاب واحد على الأقل (أو خليه مدير)');

    if (old?.isAdmin && !isAdmin && !others.some(u => u.isAdmin && u.active !== false && u.passHash) &&
        !confirm('ده آخر مدير في النظام. لو شلت صفة المدير، الحماية هتتقفل والسيستم يفتح للكل. تكمل؟')) return;

    const data = { name, phone, isAdmin, tabs: isAdmin ? [] : tabs, perms: isAdmin ? [] : perms };
    const b = document.getElementById('user-modal-save');
    b.disabled = true;
    b.textContent = 'جاري الحفظ...';
    try {
        if (pass) {
            data.passSalt = uSalt();
            data.passAlgo = uHasSubtle() ? 'pbkdf2' : 'legacy';
            data.passHash = await uHash(pass, data.passSalt, data.passAlgo);
        }
        const col = window.db.collection(USERS_CFG.collection);
        if (!id) await col.add({ ...data, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        else await col.doc(id).update({
            ...data,
            nationalId: firebase.firestore.FieldValue.delete(),   // تنظيف الحقل القديم
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        closeUserModal();
    } catch (err) {
        console.error('خطأ حفظ المستخدم:', err);
        showUserModalError('حدث خطأ أثناء الحفظ، حاول مرة أخرى.');
        b.disabled = false;
        b.textContent = 'حفظ المستخدم';
    }
}

async function toggleUserStatus(id) {
    const u = usersData.find(x => x.id === id);
    if (!u || !window.db) return;
    if (u.isAdmin && u.active !== false &&
        !usersData.some(x => x.id !== id && x.isAdmin && x.active !== false) &&
        !confirm('ده آخر مدير نشط. إيقافه هيقفل الحماية ويفتح السيستم للكل. تكمل؟')) return;
    try { await window.db.collection(USERS_CFG.collection).doc(id).update({ active: u.active === false }); }
    catch (err) { console.error('خطأ تغيير الحالة:', err); }
}

async function deleteUser(id) {
    const u = usersData.find(x => x.id === id);
    if (!u || !window.db) return;
    const lastAdmin = u.isAdmin && !usersData.some(x => x.id !== id && x.isAdmin && x.active !== false);
    const warn = lastAdmin ? '\nتنبيه: ده آخر مدير، حذفه هيقفل الحماية ويفتح السيستم للكل.' : '';
    if (!confirm(`هل أنت تأكد من حذف المستخدم "${u.name}" نهائياً؟${warn}`)) return;
    try { await window.db.collection(USERS_CFG.collection).doc(id).delete(); }
    catch (err) { console.error('خطأ حذف المستخدم:', err); alert('تعذر حذف المستخدم'); }
}

// ---------- الاستماع اللحظي ----------
function initUsersListener() {
    if (!window.db) return;
    window.db.collection(USERS_CFG.collection).onSnapshot((snap) => {
        usersData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        usersLoaded = true;
        resolveCurrentUser();
        filterUsersTable();
        renderUsersGate();
        applyUserPermissions();
    }, (err) => console.error('مزامنة المستخدمين فشلت:', err));
}

window.addEventListener('DOMContentLoaded', () => {
    startUsersObserver();
    const t = setInterval(() => {
        if (window.db) { clearInterval(t); initUsersListener(); }
    }, 100);
});