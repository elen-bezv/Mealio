"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "default" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

const variantClass: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  destructive: "btn-destructive",
};

export function Button({
  children,
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn ${variantClass[variant]} ${size === "sm" ? "btn-sm" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonSubmit({
  children,
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="submit"
      className={`btn ${variantClass[variant]} ${size === "sm" ? "btn-sm" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
