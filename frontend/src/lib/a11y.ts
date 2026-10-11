export const A11Y_STORAGE_KEY = "fsp-a11y";

export type A11yFontScale = "md" | "lg" | "xl" | "xxl";
export type A11yContrast = "normal" | "high" | "invert";
export type A11ySpacing = "normal" | "wide" | "wider";
export type A11ySpeechRate = "slow" | "normal" | "fast";

export type A11ySettings = {
  enabled: boolean;
  fontScale: A11yFontScale;
  contrast: A11yContrast;
  spacing: A11ySpacing;
  hideImages: boolean;
  speech: boolean;
  speechHover: boolean;
  speechRate: A11ySpeechRate;
};

export const DEFAULT_A11Y: A11ySettings = {
  enabled: false,
  fontScale: "lg",
  contrast: "high",
  spacing: "normal",
  hideImages: false,
  speech: false,
  speechHover: false,
  speechRate: "normal",
};

const SPEECH_RATES: Record<A11ySpeechRate, number> = {
  slow: 0.78,
  normal: 0.95,
  fast: 1.12,
};

export function loadA11ySettings(): A11ySettings {
  if (typeof window === "undefined") return DEFAULT_A11Y;
  try {
    const raw = localStorage.getItem(A11Y_STORAGE_KEY);
    if (!raw) return DEFAULT_A11Y;
    const parsed = JSON.parse(raw) as Partial<A11ySettings>;
    return { ...DEFAULT_A11Y, ...parsed };
  } catch {
    return DEFAULT_A11Y;
  }
}

export function saveA11ySettings(settings: A11ySettings) {
  try {
    localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyA11yToDocument(settings: A11ySettings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (!settings.enabled) {
    html.removeAttribute("data-a11y");
    html.removeAttribute("data-a11y-font");
    html.removeAttribute("data-a11y-contrast");
    html.removeAttribute("data-a11y-spacing");
    html.removeAttribute("data-a11y-images");
    return;
  }
  html.setAttribute("data-a11y", "on");
  html.setAttribute("data-a11y-font", settings.fontScale);
  html.setAttribute("data-a11y-contrast", settings.contrast);
  html.setAttribute("data-a11y-spacing", settings.spacing);
  html.setAttribute("data-a11y-images", settings.hideImages ? "hide" : "show");
}

export function speechRateValue(rate: A11ySpeechRate) {
  return SPEECH_RATES[rate];
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;
  if (lang.startsWith("ru")) score += 100;
  if (lang === "ru-ru") score += 20;
  if (voice.localService) score += 15;
  if (/irina|milena|ekaterina|tanya|oksana|pavel|dmitri|yuri/.test(name)) score += 40;
  if (/microsoft/.test(name) && /russian|ru/.test(name + lang)) score += 25;
  if (/google/.test(name) && lang.startsWith("ru")) score += 22;
  if (/yandex/.test(name)) score += 28;
  if (/neural|natural|premium|enhanced/.test(name)) score += 12;
  if (/compact|espeak/.test(name)) score -= 30;
  return score;
}

export function pickRussianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ranked = voices
    .filter((v) => v.lang.toLowerCase().startsWith("ru") || /russian|русск/i.test(v.name))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked[0] ?? null;
}

export function readableTextFromElement(el: Element | null): string {
  if (!el || !(el instanceof HTMLElement)) return "";
  if (el.closest("[data-a11y-widget], [aria-hidden='true']")) return "";

  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return cleanSpeechText(aria);

  if (el instanceof HTMLImageElement) {
    return cleanSpeechText(el.alt || el.title || "");
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const label =
      el.labels?.[0]?.textContent ||
      el.getAttribute("aria-label") ||
      el.getAttribute("placeholder") ||
      el.name ||
      "";
    const value =
      el instanceof HTMLSelectElement
        ? el.selectedOptions[0]?.textContent || ""
        : el.type === "password"
          ? el.value
            ? "пароль введён"
            : "пароль не введён"
          : el.value;
    return cleanSpeechText([label, value].filter(Boolean).join(". "));
  }

  if (el instanceof HTMLButtonElement || el.getAttribute("role") === "button") {
    return cleanSpeechText(el.getAttribute("aria-label") || el.innerText || el.title || "Кнопка");
  }

  if (el instanceof HTMLAnchorElement) {
    return cleanSpeechText(el.getAttribute("aria-label") || el.innerText || el.title || el.href || "Ссылка");
  }

  const text = el.innerText || el.textContent || "";
  return cleanSpeechText(text);
}

export function cleanSpeechText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[·•|]+/g, ". ")
    .replace(/\.{2,}/g, ".")
    .trim()
    .slice(0, 1200);
}

export function pageSummaryText(): string {
  if (typeof document === "undefined") return "";
  const main =
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.body;
  const title = document.title.replace(/\s*[—|].*$/, "").trim();
  const heading = main?.querySelector("h1")?.textContent?.trim() || "";
  const lead =
    main?.querySelector("p")?.textContent?.trim() ||
    main?.querySelector(".muted")?.textContent?.trim() ||
    "";
  return cleanSpeechText([title, heading, lead].filter(Boolean).join(". "));
}

/** Inline boot script — applies saved a11y attrs before paint to avoid flash. */
export const A11Y_BOOT_SCRIPT = `(function(){try{var r=localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)});if(!r)return;var s=JSON.parse(r);if(!s||!s.enabled)return;var h=document.documentElement;h.setAttribute("data-a11y","on");h.setAttribute("data-a11y-font",s.fontScale||"lg");h.setAttribute("data-a11y-contrast",s.contrast||"high");h.setAttribute("data-a11y-spacing",s.spacing||"normal");h.setAttribute("data-a11y-images",s.hideImages?"hide":"show");}catch(e){}})();`;
