"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cabinetPath, getRole, isAuthenticated, subscribeAuth } from "@/lib/api";

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

function getHomeHrefSnapshot(): string {
  if (!isAuthenticated()) return "/";
  return cabinetPath(getRole()) ?? "/";
}

function getServerHomeHrefSnapshot(): string {
  return "/";
}

export function BrandLogo({ link = true, className = "", size = "compact" }: BrandLogoProps) {
  const href = useSyncExternalStore(
    subscribeAuth,
    getHomeHrefSnapshot,
    getServerHomeHrefSnapshot,
  );

  const img = (
    // SVG brand mark — next/image adds little value here
    // eslint-disable-next-line @next/next/no-img-element
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

  const label = href === "/" ? "ФСП Match — на главную" : "ФСП Match — в кабинет";

  return (
    <Link href={href} className="fsp-logo" aria-label={label}>
      {img}
    </Link>
  );
}
