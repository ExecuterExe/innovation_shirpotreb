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
        error: 'border-neon-red/40 bg-neon-red-dim',
        success: 'border-neon-green/40 bg-neon-green-dim',
        info: 'border-corp-border bg-corp-graphite',
    };

    const toast = document.createElement('div');
    toast.className = `notification-toast flex items-center gap-3 px-6 py-4 rounded-2xl border backdrop-blur-sm max-w-[90vw] ${colors[type] || colors.info}`;

    toast.innerHTML = `
        <span class="text-lg font-bold ${type === 'error' ? 'text-neon-red' : type === 'success' ? 'text-neon-green' : 'text-corp-dim'}">${icons[type] || icons.info}</span>
        <span class="text-sm font-semibold text-corp-light">${text}</span>
    `;

    container.appendChild(toast);

    if (notifTimeout) clearTimeout(notifTimeout);
    notifTimeout = setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}