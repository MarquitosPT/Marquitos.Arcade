export const fmtPoints = (value) => new Intl.NumberFormat('pt-PT').format(Math.max(0, Math.round(value || 0)));

export function fmtTime(ms) {
    const total = Math.max(0, Math.round((ms || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const fmtClock = (seconds) => fmtTime((seconds || 0) * 1000);
