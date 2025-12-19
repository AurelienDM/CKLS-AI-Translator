/**
 * Detect language code from header label
 */
export function detectLangCodeFromHeader(label: string, languageNames: Record<string, string>): string | null {
    if (!label) return null;
    
    const raw = String(label).toLowerCase();
    
    // Check if it's a CKLS code pattern (xx-XX or xx-xx)
    const cklsPattern = /^([a-z]{2})-[a-z]{2}$/i;
    const cklsMatch = raw.match(cklsPattern);
    if (cklsMatch) {
        // Extract base language (e.g., "de" from "de-DE")
        const baseCode = cklsMatch[1].toLowerCase();
        if (languageNames[baseCode]) {
            return baseCode;
        }
    }
    
    // Direct match with language code
    if (languageNames[raw]) return raw;
    
    // Check if the raw string contains a language code
    for (const code in languageNames) {
        if (raw.includes(code.toLowerCase())) {
            return code;
        }
    }
    
    // Try first token
    const token = (raw.split(/[^a-z\-]/)[0] || "").toLowerCase();
    if (languageNames[token]) return token;
    
    // Try base language if hyphenated
    if (token.includes("-")) {
        const base = token.split("-")[0];
        if (languageNames[base]) return base;
    }
    
    return null;
}

/**
 * Slugify a string for file naming
 */
export function slugify(str: string): string {
    return String(str || "translations")
        .trim()
        .toLowerCase()
        .replace(/[\s]+/g, "-")
        .replace(/[^a-z0-9\-_]+/g, "")
        .replace(/-+/g, "-")
        .slice(0, 60) || "translations";
}

/**
 * Normalize file title for display
 */
export function normalizeFileTitle(title: string): { normalizedTitle: string; isHomePage: boolean } {
    const titleNorm = title.toLowerCase().replace(/[-_]/g, " ");
    
    // Detect if the file refers to a Home Page-type
    const isHomePage =
        titleNorm.includes("group") ||
        titleNorm.includes("home page") ||
        /\bhp\b/.test(titleNorm);
    
    return {
        normalizedTitle: isHomePage ? "Home Page" : (title || "Home Page"),
        isHomePage: isHomePage
    };
}

/**
 * Escape special regex characters
 */
export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

