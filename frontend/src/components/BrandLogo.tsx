import Link from "next/link";

type BrandLogoProps = {
  /** Если false — только картинка без ссылки (например, внутри h1) */
  link?: boolean;
  className?: string;
  /** compact — шапка кабинета; hero — крупный на лендинге; auth — логин/регистрация */
  size?: "compact" | "auth" | "hero";
};

const sizeClass: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  compact: "fsp-brand-logo fsp-brand-logo--compact",
  auth: "fsp-brand-logo fsp-brand-logo--auth",
  hero: "fsp-brand-logo fsp-brand-logo--hero",
};

export function BrandLogo({ link = true, className = "", size = "compact" }: BrandLogoProps) {
  const img = (
    <img
      src="/logo_02w.svg"
      alt="ФСП Match"
      className={[sizeClass[size], className].filter(Boolean).join(" ")}
      width={345}
      height={116}
      decoding="async"
    />
  );

  if (!link) return img;

  return (
    <Link href="/" className="fsp-logo" aria-label="ФСП Match — на главную">
      {img}
    </Link>
  );
}
