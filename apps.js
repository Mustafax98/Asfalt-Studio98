const APPS_LIST = [
    { name: 'تطبيق المناديب', icon: 'fa-motorcycle', url: '#', desc: 'متابعة الأوردرات للمناديب' },
    { name: 'تطبيق المكاتب',  icon: 'fa-building',   url: '#', desc: 'كشف حساب المكاتب' },
    { name: 'خدمة العملاء',    icon: 'fa-headset',    url: '#', desc: 'المتابعة والمكالمات' }
];

function renderApps() {
    const grid = document.getElementById('apps-grid');
    if (!grid) return;
    grid.innerHTML = APPS_LIST.map(a => `
        <a href="${a.url}" target="_blank"
           class="group bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 flex flex-col items-center text-center gap-2 transition">
            <div class="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl group-hover:scale-110 transition">
                <i class="fa-solid ${a.icon}"></i>
            </div>
            <div class="text-sm font-bold text-slate-800">${a.name}</div>
            <div class="text-[11px] text-slate-500">${a.desc}</div>
        </a>`).join('');
}

document.addEventListener('DOMContentLoaded', renderApps);
