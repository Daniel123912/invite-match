import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"], // добавили cyrillic, чтобы "Вход" не падал на фолбэк
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FSP Match — подбор ИТ-специалистов",
    template: "%s — FSP Match",
  },
  description: "Категоризация через тест + приглашения от работодателей",
  themeColor: "#0a0a12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${sora.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a12] text-white font-sans">
        {children}
      </body>
    </html>
  );
}