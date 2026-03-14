"use client";

import { type ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  /** Optional max width class override; default uses token --page-max-width */
  className?: string;
}

/**
 * Wraps page content with consistent horizontal padding, max-width, and vertical spacing.
 * Use on every main app page for aligned layout.
 */
export function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`page-container animate-fade-in ${className}`.trim()}>
      {children}
    </div>
  );
}
