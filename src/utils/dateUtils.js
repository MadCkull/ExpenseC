const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts ISO date (YYYY-MM-DD) to DD-MMM-YYYY
 * Uses string splitting to avoid timezone issues with new Date().
 * @param {string|Date} isoDate 
 * @returns {string}
 */
export const formatToEng = (isoDate) => {
    if (!isoDate) return '';

    // Handle Date objects
    if (isoDate instanceof Date) {
        const d = isoDate.getDate().toString().padStart(2, '0');
        const m = MONTHS[isoDate.getMonth()];
        const y = isoDate.getFullYear();
        return `${d}-${m}-${y}`;
    }

    // Handle string dates — parse by splitting to avoid timezone shift
    const str = String(isoDate);

    // Already in DD-MMM-YYYY format
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(str)) return str;

    // ISO YYYY-MM-DD format — split to avoid timezone issues
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, y, m, d] = match;
        const mIdx = parseInt(m, 10) - 1;
        if (mIdx >= 0 && mIdx < 12) {
            return `${d}-${MONTHS[mIdx]}-${y}`;
        }
    }

    // Fallback: try Date constructor (last resort)
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return str;
    
    const d = date.getDate().toString().padStart(2, '0');
    const m = MONTHS[date.getMonth()];
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
};

/**
 * Converts DD-MMM-YYYY to ISO date (YYYY-MM-DD)
 * @param {string} engDate 
 * @returns {string}
 */
export const parseFromEng = (engDate) => {
    if (!engDate) return '';
    const parts = engDate.split('-');
    if (parts.length !== 3) return engDate;
    
    const d = parts[0];
    const mStr = parts[1];
    const y = parts[2];
    
    const mIdx = MONTHS.indexOf(mStr);
    if (mIdx === -1) return engDate;
    
    const m = (mIdx + 1).toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Modern date formatter for UI display
 * @param {string} dateStr 
 * @returns {string}
 */
export const uiDate = (dateStr) => {
    if (!dateStr) return '';
    // If it's already in DD-MMM-YYYY, return as is
    if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) return dateStr;
    return formatToEng(dateStr);
};
