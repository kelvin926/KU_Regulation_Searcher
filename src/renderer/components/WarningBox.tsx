import { AlertTriangle, Info } from "lucide-react";

export function WarningBox({
  tone = "warning",
  children,
}: {
  tone?: "warning" | "info" | "danger";
  children: React.ReactNode;
}) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div className={`notice notice-${tone}`}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}
