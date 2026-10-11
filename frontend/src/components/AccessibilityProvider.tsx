"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyA11yToDocument,
  cleanSpeechText,
  DEFAULT_A11Y,
  loadA11ySettings,
  pageSummaryText,
  pickRussianVoice,
  readableTextFromElement,
  saveA11ySettings,
  speechRateValue,
  type A11ySettings,
} from "@/lib/a11y";

type SpeakOptions = { interrupt?: boolean; force?: boolean };

type A11yContextValue = {
  settings: A11ySettings;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  update: (patch: Partial<A11ySettings>) => void;
  reset: () => void;
  speak: (text: string, opts?: SpeakOptions) => void;
  stopSpeech: () => void;
  speakPage: () => void;
  speechSupported: boolean;
  voiceName: string | null;
};

const A11yContext = createContext<A11yContextValue | null>(null);

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useA11y must be used within AccessibilityProvider");
  return ctx;
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_A11Y);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const lastHoverText = useRef("");
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const loaded = loadA11ySettings();
    applyA11yToDocument(loaded);
    const supported = "speechSynthesis" in window;
    void Promise.resolve().then(() => {
      setSettings(loaded);
      setHydrated(true);
      setSpeechSupported(supported);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyA11yToDocument(settings);
    saveA11ySettings(settings);
  }, [settings, hydrated]);

  const refreshVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voice = pickRussianVoice(window.speechSynthesis.getVoices());
    voiceRef.current = voice;
    setVoiceName(voice?.name ?? null);
  }, []);

  useEffect(() => {
    if (!speechSupported) return;
    void Promise.resolve().then(() => refreshVoice());
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refreshVoice);
  }, [speechSupported, refreshVoice]);

  const stopSpeech = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string, opts?: SpeakOptions) => {
    const s = settingsRef.current;
    if (!opts?.force && (!s.enabled || !s.speech)) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleaned = cleanSpeechText(text);
    if (!cleaned) return;

    if (opts?.interrupt !== false) window.speechSynthesis.cancel();

    // Chrome sometimes keeps synthesis paused after cancel()
    try {
      window.speechSynthesis.resume();
    } catch {
      /* ignore */
    }

    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = "ru-RU";
    utter.rate = speechRateValue(s.speechRate);
    utter.pitch = 1;
    utter.volume = 1;
    if (voiceRef.current) utter.voice = voiceRef.current;
    window.speechSynthesis.speak(utter);
  }, []);

  const speakPage = useCallback(() => {
    speak(pageSummaryText() || "Содержимое страницы не найдено");
  }, [speak]);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.enabled === true && !prev.enabled) {
        next.speech = patch.speech ?? true;
        next.contrast = patch.contrast ?? "high";
        next.fontScale = patch.fontScale ?? "lg";
      }
      if (patch.enabled === false) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      }
      settingsRef.current = next;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    stopSpeech();
    const next = { ...DEFAULT_A11Y, enabled: true };
    settingsRef.current = next;
    setSettings(next);
  }, [stopSpeech]);

  useEffect(() => {
    if (!hydrated || !settings.enabled || !settings.speech) return;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-a11y-widget]")) return;
      const text = readableTextFromElement(target);
      if (text) speak(text);
    };

    const onMouseOver = (e: MouseEvent) => {
      if (!settingsRef.current.speechHover) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-a11y-widget]")) return;

      const speakable =
        target.closest("a,button,label,h1,h2,h3,h4,[role='button'],[role='link'],[role='tab'],.btn") ||
        (target instanceof HTMLElement &&
          (target.matches("p,li,td,th,span,strong") || Boolean(target.getAttribute("aria-label"))));

      if (!speakable || !(speakable instanceof Element)) return;
      const text = readableTextFromElement(speakable);
      if (!text || text === lastHoverText.current) return;

      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        lastHoverText.current = text;
        speak(text);
      }, 380);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mouseover", onMouseOver);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mouseover", onMouseOver);
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, [hydrated, settings.enabled, settings.speech, speak]);

  useEffect(() => {
    if (!hydrated || !settings.enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        stopSpeech();
      }
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        speakPage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, settings.enabled, speakPage, stopSpeech]);

  const value = useMemo<A11yContextValue>(
    () => ({
      settings,
      panelOpen,
      setPanelOpen,
      update,
      reset,
      speak,
      stopSpeech,
      speakPage,
      speechSupported,
      voiceName,
    }),
    [
      settings,
      panelOpen,
      update,
      reset,
      speak,
      stopSpeech,
      speakPage,
      speechSupported,
      voiceName,
    ],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}
