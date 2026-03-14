"use client";

import { type ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function Section({ children, title, subtitle, className = "" }: SectionProps) {
  return (
    <section className={`section ${className}`.trim()}>
      {title && <h2 className="section-title">{title}</h2>}
      {subtitle && <p className="page-subtitle mb-4">{subtitle}</p>}
      {children}
    </section>
  );
}
