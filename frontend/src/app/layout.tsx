import type { Metadata } from "next";
import { Onest, Unbounded } from "next/font/google";
import { A11yShell } from "@/components/A11yShell";
import { A11Y_BOOT_SCRIPT } from "@/lib/a11y";
import "./globals.css";
import "./a11y.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "FSP Match — подбор ИТ-специалистов",
  description: "Категоризация через тест + приглашения от работодателей",
  icons: {
    icon: "/logo_02w.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${onest.variable} ${unbounded.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <A11yShell>{children}</A11yShell>
      </body>
    </html>
  );
}
