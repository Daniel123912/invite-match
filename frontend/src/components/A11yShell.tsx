"use client";

import type { ReactNode } from "react";
import { AccessibilityProvider } from "@/components/AccessibilityProvider";
import { AccessibilityWidget } from "@/components/AccessibilityWidget";

export function A11yShell({ children }: { children: ReactNode }) {
  return (
    <AccessibilityProvider>
      {children}
      <AccessibilityWidget />
    </AccessibilityProvider>
  );
}
