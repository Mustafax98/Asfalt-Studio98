/* =====================================================================
   staff.js — إعدادات > الموظفين (CRM)
   كوليكشن: staff       { name, phone, active, createdAt }
   كوليكشن: statusLogs  { orderId, from, to, by, person, employee, at }  (بيتكتب من apps.js)
   كل الأرقام بتتحسب تلقائي من orders + statusLogs
   ===================================================================== */
(function () {
    'use strict';

    // ====== إعدادات تقدر تعدلها ======
    const CFG = {
        staffCol: 'staff',
        ordersCol: 'orders',
        logsCol: 'statusLogs',
        activityCol: 'staffActivity',         // سجل النشاط التفصيلي (بيتكتب من apps.js)
        noAnswer: /لا\s*يرد/,                 // حالة "لا يرد"
        contacted: /تم\s*التواصل|تواصل/,      // حالة "تم التواصل"
        delivered: /مكتمل|استلم|تسليم/        // الحالات اللي تعتبر متسلّمة
    };

    let staff = [], orders = [], logs = [];

    // ---------- أدوات ----------
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
    const norm = (s) => clean(s).toLowerCase()
        .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652\u0640]/g, '');
    const cmp = (a, b) => norm(a).localeCompare(norm(b), 'ar', { numeric: true });
    const pick = (o, keys) => { for (const k of keys) if (o[k] != null && String(o[k]).trim() !== '') return String(o[k]); return ''; };
    const employeeOf = (o) => pick(o, ['employee', 'follower', 'followUp']);
    const statusOf = (o) => pick(o, ['status']);

    function isDup(name, excludeId = '') {
        const n = norm(name);
        return staff.some(s => s.id !== excludeId && norm(s.name) === n);
    }

    // ---------- الإحصائيات ----------
    function computeStats() {
        const map = {};
        const get = (name) => (map[norm(name)] = map[norm(name)] || {
            cases: 0, converted: 0, noAnswerOrders: new Set(), convertedOrders: new Set(),
            total: 0, delivered: 0, open: 0, pending: 0
        });

        // الأوردرات
        orders.forEach(o => {
            const emp = employeeOf(o);
            if (!emp) return;
            const s = get(emp);
            s.total++;
            if (CFG.delivered.test(statusOf(o))) s.delivered++;
            if (o.closed !== true) {
                s.open++;
                if (o.actionRequired === true) s.pending++;
            }
        });

        // السجل: تغييرات الحالة اللي عملها المتابع (بـ by = follow)
        logs.forEach(l => {
            if (l.employee && CFG.noAnswer.test(l.to || '')) get(l.employee).noAnswerOrders.add(l.orderId);
            if (l.by !== 'follow' || !l.person) return;
            const s = get(l.person);
            s.cases++;
            if (CFG.noAnswer.test(l.from || '') && CFG.contacted.test(l.to || '')) s.convertedOrders.add(l.orderId);
        });

        Object.values(map).forEach(s => {
            const denom = s.noAnswerOrders.size;
            const num = [...s.convertedOrders].filter(id => s.noAnswerOrders.has(id) || true).length;
            s.contactRate = denom > 0 ? Math.min(100, Math.round((num / denom) * 100)) : null;
            s.deliveryRate = s.total > 0 ? s.delivered / s.total : null;
            s.rating = computeRating(s);
        });
        return map;
    }

    // التقييم من 5: التواصل 40% + التسليم 40% + قلة الإجراءات المعلّقة 20%
    function computeRating(s) {
        if (s.contactRate === null && s.deliveryRate === null) return null;
        const c = s.contactRate === null ? 0.5 : s.contactRate / 100;
        const d = s.deliveryRate === null ? 0.5 : s.deliveryRate;
        const p = s.open > 0 ? 1 - (s.pending / s.open) : 1;
        return Math.round((c * 0.4 + d * 0.4 + p * 0.2) * 5 * 10) / 10;
    }

    const ratingBadge = (r) => {
        if (r === null) return '<span class="text-slate-300">—</span>';
        const cls = r >= 4 ? 'bg-emerald-100 text-emerald-800' : r >= 2.5 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}">★ ${r.toFixed(1)}</span>`;
    };

    // ---------- العرض ----------
    function render() {
        const tbody = document.getElementById('staff-table-body');
        if (!tbody) return;

        const q = norm(document.getElementById('staff-search-input')?.value || '');
        const list = staff
            .filter(s => !q || norm(s.name).includes(q) || norm(s.phone).includes(q))
            .sort((a, b) => cmp(a.name, b.name));

        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-400 font-medium">لا يوجد موظفون مضافون حتى الآن</td></tr>`;
            return;
        }

        const stats = computeStats();
        const zero = { cases: 0, contactRate: null, delivered: 0, open: 0, pending: 0, total: 0, rating: null };

        tbody.innerHTML = list.map(m => {
            const s = stats[norm(m.name)] || zero;
            const active = m.active !== false;
            const rate = s.contactRate === null
                ? '<span class="text-slate-300">—</span>'
                : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.contactRate >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${s.contactRate}%</span>`;
            const pending = s.pending > 0
                ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">${s.pending.toLocaleString()}</span>`
                : '<span class="text-slate-400">0</span>';

            return `
            <tr class="hover:bg-slate-50/80 transition-colors ${active ? '' : 'bg-slate-50/60'}">
                <td class="p-3.5">
                    <button type="button" onclick="openStaffActivity('${m.id}')" title="عرض سجل النشاط"
                        class="font-semibold text-slate-800 hover:text-emerald-700 hover:underline inline-flex items-center gap-1.5">
                        ${esc(m.name)} <i class="fa-regular fa-clock text-[10px] text-slate-400"></i>
                    </button>
                </td>
                <td class="p-3.5 font-mono text-slate-500" dir="ltr">${esc(m.phone || '')}</td>
                <td class="p-3.5 text-center font-semibold text-slate-700">${s.cases.toLocaleString()}</td>
                <td class="p-3.5 text-center">${rate}</td>
                <td class="p-3.5 text-center font-semibold text-emerald-600">${s.delivered.toLocaleString()}</td>
                <td class="p-3.5 text-center font-semibold text-slate-700">${s.open.toLocaleString()}</td>
                <td class="p-3.5 text-center">${pending}</td>
                <td class="p-3.5 text-center">${ratingBadge(s.rating)}</td>
                <td class="p-3.5 text-center">
                    ${active
                    ? '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> نشط</span>'
                    : '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> غير نشط</span>'}
                </td>
                <td class="p-3.5 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <button type="button" onclick="toggleStaffStatus('${m.id}')"
                            class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${active ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'}">
                            ${active ? 'إيقاف' : 'تفعيل'}
                        </button>
                        <button type="button" onclick="openEditStaffModal('${m.id}')" title="تعديل"
                            class="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" onclick="deleteStaff('${m.id}')" title="حذف"
                            class="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ---------- النافذة ----------
    function ensureModal() {
        if (document.getElementById('staff-modal')) return;
        const w = document.createElement('div');
        w.innerHTML = `
        <div id="staff-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center z-[9999] p-4" dir="rtl">
            <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h4 id="staff-modal-title" class="text-base font-bold text-slate-800">تعيين موظف جديد</h4>
                    <button type="button" onclick="closeStaffModal()" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">✕</button>
                </div>
                <form id="staff-modal-form" onsubmit="handleStaffSubmit(event)" class="space-y-3" autocomplete="off">
                    <input type="hidden" id="staff-modal-id">
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1">اسم الموظف</label>
                        <input type="text" id="staff-modal-name" required oninput="clearStaffModalError()"
                            class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1">رقم الموبايل</label>
                        <input type="tel" id="staff-modal-phone" required dir="ltr" placeholder="01xxxxxxxxx" oninput="clearStaffModalError()"
                            class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-right">
                        <p id="staff-modal-error" class="hidden mt-1.5 text-[11px] font-semibold text-rose-600"></p>
                    </div>
                    <div class="flex justify-end gap-2 pt-2">
                        <button type="button" onclick="closeStaffModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold">إلغاء</button>
                        <button type="submit" id="staff-modal-save" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50">حفظ</button>
                    </div>
                </form>
            </div>
        </div>`;
        document.body.appendChild(w.firstElementChild);
        const modal = document.getElementById('staff-modal');
        modal.addEventListener('click', (e) => { if (e.target === modal) closeStaffModal(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeStaffModal();
        });
    }

    function showErr(msg) {
        const el = document.getElementById('staff-modal-error');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    }
    window.clearStaffModalError = () => document.getElementById('staff-modal-error')?.classList.add('hidden');

    function openModal(title, id = '', name = '', phone = '') {
        ensureModal();
        document.getElementById('staff-modal-title').textContent = title;
        document.getElementById('staff-modal-id').value = id;
        document.getElementById('staff-modal-name').value = name;
        document.getElementById('staff-modal-phone').value = phone;
        clearStaffModalError();
        const btn = document.getElementById('staff-modal-save');
        btn.disabled = false; btn.textContent = 'حفظ';
        const m = document.getElementById('staff-modal');
        m.classList.remove('hidden'); m.classList.add('flex');
        setTimeout(() => document.getElementById('staff-modal-name').focus(), 50);
    }

    window.addNewStaffRow = () => openModal('تعيين موظف جديد');
    window.openEditStaffModal = (id) => {
        const m = staff.find(s => s.id === id);
        if (m) openModal('تعديل بيانات الموظف', m.id, m.name || '', m.phone || '');
    };
    window.closeStaffModal = () => {
        const m = document.getElementById('staff-modal');
        if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    };

    // ---------- الحفظ ----------
    window.handleStaffSubmit = async function (e) {
        e.preventDefault();
        if (!window.db) return;

        const id = document.getElementById('staff-modal-id').value;
        const name = clean(document.getElementById('staff-modal-name').value);
        const phone = document.getElementById('staff-modal-phone').value.replace(/[\s-]/g, '');

        if (!name) return showErr('اكتب اسم الموظف');
        if (!/^\+?\d{10,15}$/.test(phone)) return showErr('رقم الموبايل غير صحيح');
        if (isDup(name, id)) return showErr(`الموظف "${name}" موجود بالفعل، مينفعش يتكرر`);
        if (staff.some(s => s.id !== id && s.phone === phone)) return showErr('رقم الموبايل مسجل لموظف آخر');

        const btn = document.getElementById('staff-modal-save');
        btn.disabled = true; btn.textContent = 'جاري الحفظ...';

        try {
            const col = window.db.collection(CFG.staffCol);
            if (!id) {
                await col.add({ name, phone, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            } else {
                const oldName = staff.find(s => s.id === id)?.name || '';
                await col.doc(id).update({ name, phone, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
                if (oldName && oldName !== name) await renameInOrders(oldName, name);
            }
            closeStaffModal();
        } catch (err) {
            console.error('خطأ أثناء حفظ الموظف:', err);
            showErr('حدث خطأ أثناء الحفظ، حاول مرة أخرى.');
            btn.disabled = false; btn.textContent = 'حفظ';
        }
    };

    // لو الاسم اتغير: نحدّث الأوردرات (والسجل) عشان الإحصائيات متضيعش
    async function renameInOrders(oldName, newName) {
        const targets = [
            [CFG.ordersCol, 'employee'],
            [CFG.logsCol, 'person'],
            [CFG.logsCol, 'employee'],
            [CFG.activityCol, 'person'],
            [CFG.activityCol, 'employee']
        ];
        for (const [col, field] of targets) {
            const snap = await window.db.collection(col).where(field, '==', oldName).get();
            const docs = snap.docs;
            for (let i = 0; i < docs.length; i += 400) {
                const batch = window.db.batch();
                docs.slice(i, i + 400).forEach(d => batch.update(d.ref, { [field]: newName }));
                await batch.commit();
            }
        }
    }

    window.toggleStaffStatus = function (id) {
        const m = staff.find(s => s.id === id);
        if (!m || !window.db) return;
        window.db.collection(CFG.staffCol).doc(id)
            .update({ active: m.active === false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
            .catch(err => console.error('خطأ تغيير حالة الموظف:', err));
    };

    window.deleteStaff = function (id) {
        const m = staff.find(s => s.id === id);
        if (!m || !window.db) return;
        if (confirm(`هل أنت تأكد من حذف الموظف "${m.name}" نهائياً؟\n(الأوردرات المسجلة عليه مش هتتحذف)`)) {
            window.db.collection(CFG.staffCol).doc(id).delete()
                .catch(err => console.error('خطأ حذف الموظف:', err));
        }
    };

    // ==================================================================
    // سجل النشاط: بيفتح لما تدوس على اسم الموظف
    // ==================================================================
    const TYPE_META = {
        status: { label: 'تغيير حالة', icon: 'fa-arrows-rotate', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
        edit: { label: 'تعديل بيانات', icon: 'fa-pen', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        review: { label: 'مراجعة', icon: 'fa-check', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        copy: { label: 'نسخ طلب', icon: 'fa-copy', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
        call: { label: 'اتصال', icon: 'fa-phone', cls: 'bg-purple-50 text-purple-700 border-purple-200' }
    };
    const ACT = { staffId: '', unsub: null, rows: [], limit: 100 };

    const toDate = (l) => (l.at && l.at.toDate) ? l.at.toDate() : new Date();
    const fmtTime = (d) => d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const fmtDay = (d) => d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const dayKey = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

    function ensureActivityModal() {
        if (document.getElementById('staff-activity-modal')) return;
        const w = document.createElement('div');
        w.innerHTML = `
        <div id="staff-activity-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center z-[9999] p-4" dir="rtl">
            <div class="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
                <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <h4 id="act-title" class="text-base font-bold text-slate-800"></h4>
                        <p id="act-sub" class="text-[11px] text-slate-400 mt-0.5"></p>
                    </div>
                    <button type="button" onclick="closeStaffActivity()" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">✕</button>
                </div>
                <div id="act-summary" class="grid grid-cols-3 sm:grid-cols-6 gap-2 px-5 pt-4"></div>
                <div class="flex flex-wrap items-center gap-2 px-5 py-3">
                    <select id="act-type" onchange="actFilterChanged()" class="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500">
                        <option value="">كل الأنواع</option>
                        ${Object.entries(TYPE_META).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                    </select>
                    <input type="date" id="act-from" onchange="actFilterChanged()" class="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500">
                    <input type="date" id="act-to" onchange="actFilterChanged()" class="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500">
                    <input type="text" id="act-search" oninput="actFilterChanged()" placeholder="بحث بكود الطلب أو العميل أو التعديل..."
                        class="flex-1 min-w-[180px] px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500">
                </div>
                <div id="act-list" class="px-5 pb-5 overflow-y-auto space-y-1"></div>
            </div>
        </div>`;
        document.body.appendChild(w.firstElementChild);
        const modal = document.getElementById('staff-activity-modal');
        modal.addEventListener('click', (e) => { if (e.target === modal) closeStaffActivity(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeStaffActivity();
        });
    }

    window.openStaffActivity = function (id) {
        const m = staff.find(s => s.id === id);
        if (!m || !window.db) return;
        ensureActivityModal();

        ACT.staffId = id; ACT.rows = []; ACT.limit = 100;
        ['act-type', 'act-from', 'act-to', 'act-search'].forEach(x => { document.getElementById(x).value = ''; });
        document.getElementById('act-title').textContent = 'سجل نشاط: ' + m.name;
        document.getElementById('act-sub').textContent = m.phone || '';
        document.getElementById('act-list').innerHTML = '<div class="p-8 text-center text-xs text-slate-400">جاري التحميل...</div>';

        const modal = document.getElementById('staff-activity-modal');
        modal.classList.remove('hidden'); modal.classList.add('flex');

        if (ACT.unsub) ACT.unsub();
        ACT.unsub = window.db.collection(CFG.activityCol)
            .where('person', '==', m.name).where('by', '==', 'follow')
            .onSnapshot((snap) => {
                ACT.rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => toDate(b) - toDate(a));
                renderActivity();
            }, (err) => {
                console.error('سجل النشاط فشل:', err);
                document.getElementById('act-list').innerHTML = '<div class="p-8 text-center text-xs text-rose-500">تعذر تحميل السجل</div>';
            });
    };

    window.closeStaffActivity = function () {
        if (ACT.unsub) { ACT.unsub(); ACT.unsub = null; }
        const m = document.getElementById('staff-activity-modal');
        if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
    };

    window.actFilterChanged = () => { ACT.limit = 100; renderActivity(); };
    window.actMore = () => { ACT.limit += 100; renderActivity(); };

    function renderActivity() {
        const list = document.getElementById('act-list');
        if (!list) return;

        const type = document.getElementById('act-type').value;
        const from = document.getElementById('act-from').value;
        const to = document.getElementById('act-to').value;
        const q = norm(document.getElementById('act-search').value);
        const fromD = from ? new Date(from + 'T00:00:00') : null;
        const toD = to ? new Date(to + 'T23:59:59') : null;

        // ملخص (على كل السجل بدون فلاتر)
        const todayKey = dayKey(new Date());
        const counts = {}; let today = 0;
        ACT.rows.forEach(r => {
            counts[r.type] = (counts[r.type] || 0) + 1;
            if (dayKey(toDate(r)) === todayKey) today++;
        });
        const chip = (label, n, cls = 'bg-slate-50 text-slate-700') =>
            `<div class="rounded-xl border border-slate-100 p-2 text-center ${cls}"><div class="text-[10px] font-semibold">${label}</div><div class="text-base font-bold">${n.toLocaleString()}</div></div>`;
        document.getElementById('act-summary').innerHTML =
            chip('الإجمالي', ACT.rows.length) + chip('اليوم', today, 'bg-emerald-50 text-emerald-700') +
            Object.entries(TYPE_META).slice(0, 4).map(([k, v]) => chip(v.label, counts[k] || 0)).join('');

        const rows = ACT.rows.filter(r => {
            const d = toDate(r);
            if (type && r.type !== type) return false;
            if (fromD && d < fromD) return false;
            if (toD && d > toD) return false;
            if (q) {
                const hay = norm([r.orderId, r.customer, ...(r.changes || []).map(c => `${c.label} ${c.from} ${c.to}`)].join(' '));
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        if (!rows.length) {
            list.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">لا يوجد نشاط مسجل</div>';
            return;
        }

        const shown = rows.slice(0, ACT.limit);
        let lastDay = '';
        list.innerHTML = shown.map(r => {
            const d = toDate(r), k = dayKey(d);
            const head = k !== lastDay
                ? `<div class="sticky top-0 bg-white/95 py-1.5 text-[11px] font-bold text-slate-500 border-b border-slate-100">${fmtDay(d)}</div>` : '';
            lastDay = k;
            const meta = TYPE_META[r.type] || TYPE_META.edit;
            const changes = (r.changes || []).map(c => `
                <div class="text-[11px] text-slate-600">
                    <span class="font-semibold">${esc(c.label)}:</span>
                    <span class="text-slate-400 line-through">${esc(c.from || '—')}</span>
                    <i class="fa-solid fa-arrow-left text-[9px] text-slate-400 mx-1"></i>
                    <span class="font-semibold text-slate-800">${esc(c.to || '—')}</span>
                </div>`).join('');
            return head + `
            <div class="flex items-start gap-3 py-2 border-b border-slate-50">
                <div class="w-14 shrink-0 text-[11px] text-slate-400 pt-0.5" dir="ltr">${fmtTime(d)}</div>
                <div class="flex-1 min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.cls}"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>
                        <span class="text-xs font-bold text-slate-800" dir="ltr">${esc(r.orderId || '')}</span>
                        <span class="text-[11px] text-slate-500">${esc(r.customer || '')}</span>
                    </div>
                    ${changes}
                </div>
            </div>`;
        }).join('') + (rows.length > shown.length
            ? `<button type="button" onclick="actMore()" class="w-full mt-2 py-2 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100">عرض المزيد (${rows.length - shown.length})</button>` : '');
    }

    window.filterStaffTable = render;

    // ---------- الاستماع اللحظي ----------
    function start() {
        window.db.collection(CFG.staffCol).onSnapshot((snap) => {
            staff = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            render();
        }, (err) => console.error('مزامنة الموظفين فشلت:', err));

        window.db.collection(CFG.ordersCol).onSnapshot((snap) => {
            orders = snap.docs.map(d => d.data());
            render();
        }, (err) => console.error('staff.js orders:', err));

        window.db.collection(CFG.logsCol).onSnapshot((snap) => {
            logs = snap.docs.map(d => d.data());
            render();
        }, (err) => console.error('staff.js logs:', err));
    }

    function waitDb(n) {
        if (window.db) return start();
        if (n > 100) return console.error('staff.js: window.db غير متاح');
        setTimeout(() => waitDb(n + 1), 100);
    }
    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', () => waitDb(0))
        : waitDb(0);
})();