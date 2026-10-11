"use client";

import { MASK_EMAIL, MASK_PHONE, MASK_TELEGRAM } from "@/lib/masks";

type Props = {
  revealed?: boolean;
  phone?: string | null;
  email?: string | null;
  telegram?: string | null;
  phoneDisplay?: string | null;
  emailDisplay?: string | null;
  telegramDisplay?: string | null;
  revoked?: boolean;
  className?: string;
};

export function ContactMasks({
  revealed,
  phone,
  email,
  telegram,
  phoneDisplay,
  emailDisplay,
  telegramDisplay,
  revoked,
  className = "",
}: Props) {
  if (revoked) {
    return (
      <p className={`text-sm text-[var(--warn)] ${className}`}>
        Кандидат отозвал доступ к контактам
      </p>
    );
  }

  const phoneShow = revealed && phone ? phone : phoneDisplay || MASK_PHONE;
  const emailShow = revealed && email ? email : emailDisplay || MASK_EMAIL;
  const tgShow = revealed && telegram ? telegram : telegramDisplay || MASK_TELEGRAM;

  return (
    <div className={`space-y-1 text-sm ${className}`}>
      <p>
        <span className="muted">Телефон:</span>{" "}
        <span className={revealed ? "" : "font-mono tracking-wide text-[var(--muted)]"}>
          {phoneShow}
        </span>
      </p>
      <p>
        <span className="muted">Email:</span>{" "}
        <span className={revealed ? "" : "font-mono tracking-wide text-[var(--muted)]"}>
          {emailShow}
        </span>
      </p>
      <p>
        <span className="muted">Telegram:</span>{" "}
        <span className={revealed ? "" : "font-mono tracking-wide text-[var(--muted)]"}>
          {tgShow}
        </span>
      </p>
      {!revealed && (
        <p className="muted text-xs">Контакты скрыты маской до принятия приглашения</p>
      )}
    </div>
  );
}
