/**
 * Maps LVGL/ESPHome font identifiers to web-compatible font families.
 */
const FONT_MAP: Record<string, string> = {
    'montserrat': 'Montserrat',
    'unscii': 'monospace',
    'dejavu': 'DejaVu Sans',
    'simsun': 'SimSun',
    'roboto': 'Roboto',
    'inter': 'Inter'
};

/**
 * Resolves an LVGL font name (e.g. "montserrat_20", "lv.font_montserrat_14") 
 * to a browser-compatible font family name.
 */
export const resolveFontFamily = (fontName: string | undefined): string => {
    if (!fontName) return 'inherit';

    // Remove "lv.font_" prefix if present
    let clean = fontName.toLowerCase().replace(/^lv\.font_/, '');

    // Extract the family part (before the last underscore if it followed by a number)
    // e.g. "montserrat_20" -> "montserrat", "my_custom_font" -> "my_custom_font"
    const parts = clean.split('_');
    if (parts.length > 1 && !isNaN(Number(parts[parts.length - 1]))) {
        clean = parts.slice(0, -1).join('_');
    }

    // Check our map
    if (FONT_MAP[clean]) return FONT_MAP[clean];

    // Default to the cleaned name but capitalized for better Google Fonts compatibility
    return clean.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

/**
 * Extracts the size from an LVGL font name if available.
 */
export const resolveFontSize = (fontName: string | undefined): number | undefined => {
    if (!fontName) return undefined;
    const parts = fontName.split('_');
    const lastPart = parts[parts.length - 1];
    if (!isNaN(Number(lastPart))) {
        return Number(lastPart);
    }
    return undefined;
};
