// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════

let notifTimeout = null;

export function showNotification(text, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    // Remove existing
    const existing = container.querySelector('.notification-toast');
    if (existing) {
        existing.classList.add('exiting');
        setTimeout(() => existing.remove(), 300);
    }

    const icons = { error: '✕', success: '✓', info: 'ℹ' };
    const colors = {
        error: 'border-accent-red/40 bg-corp-graphite',
        success: 'border-accent-green/40 bg-corp-graphite',
        info: 'border-corp-border bg-corp-graphite',
    };

    const toast = document.createElement('div');
    toast.className = `notification-toast flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-sm max-w-[90vw] ${colors[type] || colors.info}`;

    toast.innerHTML = `
        <span class="text-lg font-bold ${type === 'error' ? 'text-accent-red' : type === 'success' ? 'text-accent-green' : 'text-corp-dim'}">${icons[type] || icons.info}</span>
        <span class="text-sm font-semibold text-corp-light">${text}</span>
    `;

    container.appendChild(toast);

    if (notifTimeout) clearTimeout(notifTimeout);
    notifTimeout = setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}