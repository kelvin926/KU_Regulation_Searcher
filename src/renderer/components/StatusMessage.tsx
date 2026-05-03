import type { ReactNode } from "react";
import { WarningBox } from "./WarningBox";

interface StatusMessageProps {
  message: ReactNode | null | undefined;
  tone?: "info" | "warning" | "danger";
}

export function StatusMessage({ message, tone }: StatusMessageProps) {
  if (!message) return null;
  return <WarningBox tone={tone}>{message}</WarningBox>;
}
