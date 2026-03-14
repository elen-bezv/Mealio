"use client";

import { type CSSProperties, type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  /** Use for clickable cards (e.g. dashboard links) */
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({ children, interactive, className = "", style, onClick }: CardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`card ${interactive ? "card-interactive cursor-pointer" : ""} ${className}`.trim()}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
