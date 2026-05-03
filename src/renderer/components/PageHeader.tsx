import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  level?: "h1" | "h2";
  className?: string;
  children?: ReactNode;
}

export function PageHeader({ title, level = "h1", className, children }: PageHeaderProps) {
  const Heading = level;
  return (
    <div className={["section-heading", className].filter(Boolean).join(" ")}>
      <Heading>{title}</Heading>
      {children}
    </div>
  );
}
