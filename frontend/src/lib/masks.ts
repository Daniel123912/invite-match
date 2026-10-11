/** Маски ПДн и ввода телефона (152-ФЗ / UX). */

export const MASK_PHONE = "+7 ••• •••-••-••";
export const MASK_EMAIL = "•••@•••.••";
export const MASK_TELEGRAM = "@••••••";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Маска ввода российского телефона: +7 (XXX) XXX-XX-XX */
export function formatPhoneInput(raw: string): string {
  let d = digitsOnly(raw);
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d && !d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  if (!d) return "";
  let out = "+7";
  if (d.length > 1) out += " (" + d.slice(1, 4);
  if (d.length >= 4) out += ")";
  if (d.length > 4) out += " " + d.slice(4, 7);
  if (d.length > 7) out += "-" + d.slice(7, 9);
  if (d.length > 9) out += "-" + d.slice(9, 11);
  return out;
}

export function phoneToE164(masked: string): string {
  const d = digitsOnly(masked);
  if (!d) return "";
  const n = d.startsWith("8") ? "7" + d.slice(1) : d.startsWith("7") ? d : "7" + d;
  return n.length >= 11 ? `+${n.slice(0, 11)}` : `+${n}`;
}
