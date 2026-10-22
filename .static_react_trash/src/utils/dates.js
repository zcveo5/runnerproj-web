export default function formatRelativeTime(dateStr) {
    const targetDate = new Date(dateStr);
    const now = new Date();

    // Сбрасываем время до начала дня, чтобы считать именно чистые дни
    targetDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffInMs = targetDate.getTime() - now.getTime();
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Сегодня';
    if (diffInDays === 1) return 'Завтра';
    if (diffInDays === -1) return 'Вчера';

    // Для остальных случаев задействуем нативный RelativeTimeFormat
    const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

    if (Math.abs(diffInDays) >= 7 && Math.abs(diffInDays) % 7 === 0) {
        return rtf.format(diffInDays / 7, 'week'); // "через 1 неделю", "через 2 недели"
    }

    return rtf.format(diffInDays, 'day'); // "через 2 дня", "через 5 дней"
}

export function stringifyDate(date) {
    const year = date.getFullYear();

    // Прибавляем 1 к месяцу и дополняем нулем слева, если число однозначное
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Берем день месяца вместо дня недели
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}.${month}.${day}`;
}
