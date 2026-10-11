"use client";

import { useA11y } from "@/components/AccessibilityProvider";
import type { A11yContrast, A11yFontScale, A11ySpacing, A11ySpeechRate } from "@/lib/a11y";

const FONT_OPTIONS: { value: A11yFontScale; label: string }[] = [
  { value: "md", label: "Обычный" },
  { value: "lg", label: "Крупный" },
  { value: "xl", label: "Очень крупный" },
  { value: "xxl", label: "Максимум" },
];

const CONTRAST_OPTIONS: { value: A11yContrast; label: string }[] = [
  { value: "normal", label: "Обычный" },
  { value: "high", label: "Высокий" },
  { value: "invert", label: "Инверсия" },
];

const SPACING_OPTIONS: { value: A11ySpacing; label: string }[] = [
  { value: "normal", label: "Обычный" },
  { value: "wide", label: "Широкий" },
  { value: "wider", label: "Макс." },
];

const RATE_OPTIONS: { value: A11ySpeechRate; label: string }[] = [
  { value: "slow", label: "Медленно" },
  { value: "normal", label: "Нормально" },
  { value: "fast", label: "Быстро" },
];

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function AccessibilityWidget() {
  const {
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
  } = useA11y();

  const enabled = settings.enabled;

  return (
    <div className="a11y-root" data-a11y-widget>
      <button
        type="button"
        className={`a11y-fab${enabled ? " is-on" : ""}`}
        aria-expanded={panelOpen}
        aria-controls="a11y-panel"
        aria-label={enabled ? "Настройки версии для слабовидящих" : "Версия для слабовидящих"}
        onClick={() => {
          setPanelOpen(!panelOpen);
          if (!panelOpen) {
            speak(
              enabled
                ? "Панель доступности открыта"
                : "Версия для слабовидящих. Включите режим в панели.",
              { force: true },
            );
          }
        }}
      >
        <EyeIcon />
        <span className="a11y-fab-label">Для слабовидящих</span>
      </button>

      {panelOpen && (
        <div
          id="a11y-panel"
          className="a11y-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Версия для слабовидящих"
        >
          <div className="a11y-panel-head">
            <div>
              <p className="a11y-panel-title">Версия для слабовидящих</p>
              <p className="a11y-panel-sub">
                Настройки не меняют обычный дизайн, пока режим выключен
              </p>
            </div>
            <button
              type="button"
              className="a11y-icon-btn"
              aria-label="Закрыть панель"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </div>

          <label className="a11y-toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                const on = e.target.checked;
                update({ enabled: on });
                speak(
                  on ? "Режим для слабовидящих включён" : "Режим выключен. Обычный вид сайта.",
                  { force: true },
                );
              }}
            />
            <span>Включить режим</span>
          </label>

          <fieldset className="a11y-fieldset" disabled={!enabled}>
            <legend>Размер шрифта</legend>
            <div className="a11y-seg">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={settings.fontScale === opt.value ? "is-active" : undefined}
                  aria-pressed={settings.fontScale === opt.value}
                  onClick={() => {
                    update({ fontScale: opt.value });
                    speak(`Размер шрифта: ${opt.label}`);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-fieldset" disabled={!enabled}>
            <legend>Контраст</legend>
            <div className="a11y-seg">
              {CONTRAST_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={settings.contrast === opt.value ? "is-active" : undefined}
                  aria-pressed={settings.contrast === opt.value}
                  onClick={() => {
                    update({ contrast: opt.value });
                    speak(`Контраст: ${opt.label}`);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="a11y-fieldset" disabled={!enabled}>
            <legend>Интервалы</legend>
            <div className="a11y-seg">
              {SPACING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={settings.spacing === opt.value ? "is-active" : undefined}
                  aria-pressed={settings.spacing === opt.value}
                  onClick={() => {
                    update({ spacing: opt.value });
                    speak(`Интервалы: ${opt.label}`);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className={`a11y-toggle${enabled ? "" : " is-disabled"}`}>
            <input
              type="checkbox"
              checked={settings.hideImages}
              disabled={!enabled}
              onChange={(e) => {
                update({ hideImages: e.target.checked });
                speak(e.target.checked ? "Изображения скрыты" : "Изображения показаны");
              }}
            />
            <span>Скрыть изображения</span>
          </label>

          <fieldset className="a11y-fieldset a11y-speech" disabled={!enabled || !speechSupported}>
            <legend>Озвучивание</legend>
            {!speechSupported ? (
              <p className="a11y-hint">Браузер не поддерживает синтез речи</p>
            ) : (
              <>
                <label className="a11y-toggle">
                  <input
                    type="checkbox"
                    checked={settings.speech}
                    onChange={(e) => {
                      update({ speech: e.target.checked });
                      if (!e.target.checked) {
                        stopSpeech();
                        speak("Озвучивание выключено", { force: true });
                      } else {
                        speak("Озвучивание включено", { force: true });
                      }
                    }}
                  />
                  <span>Читать при фокусе</span>
                </label>
                <label className="a11y-toggle">
                  <input
                    type="checkbox"
                    checked={settings.speechHover}
                    disabled={!settings.speech}
                    onChange={(e) => {
                      update({ speechHover: e.target.checked });
                      speak(
                        e.target.checked
                          ? "Озвучивание при наведении включено"
                          : "Озвучивание при наведении выключено",
                      );
                    }}
                  />
                  <span>Читать при наведении</span>
                </label>
                <div className="a11y-seg">
                  {RATE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={settings.speechRate === opt.value ? "is-active" : undefined}
                      aria-pressed={settings.speechRate === opt.value}
                      disabled={!settings.speech}
                      onClick={() => {
                        update({ speechRate: opt.value });
                        speak(`Скорость речи: ${opt.label}`);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {voiceName && (
                  <p className="a11y-hint" title={voiceName}>
                    Голос: {voiceName}
                  </p>
                )}
                <div className="a11y-actions">
                  <button
                    type="button"
                    className="a11y-action"
                    disabled={!settings.speech}
                    onClick={() => speakPage()}
                  >
                    Прочитать страницу
                  </button>
                  <button type="button" className="a11y-action a11y-action-ghost" onClick={() => stopSpeech()}>
                    Стоп
                  </button>
                </div>
                <p className="a11y-hint">Горячие клавиши: Alt+R — страница, Alt+S — стоп</p>
              </>
            )}
          </fieldset>

          <div className="a11y-footer">
            <button
              type="button"
              className="a11y-action a11y-action-ghost"
              disabled={!enabled}
              onClick={() => {
                reset();
                speak("Настройки сброшены к удобным значениям по умолчанию");
              }}
            >
              Сбросить
            </button>
            <button
              type="button"
              className="a11y-action"
              onClick={() => {
                update({ enabled: false });
                setPanelOpen(false);
                stopSpeech();
              }}
            >
              Обычный вид
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
