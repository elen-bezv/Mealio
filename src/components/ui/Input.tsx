"use client";

import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export function Input({ label, helper, error, id, className = "", ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? `input-${generatedId.replace(/:/g, "")}`;
  return (
    <div className="input-wrap">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input ${error ? "border-red-500/50" : ""} ${className}`.trim()}
        aria-invalid={!!error}
        aria-describedby={helper ? `${inputId}-helper` : undefined}
        {...props}
      />
      {helper && !error && (
        <p id={`${inputId}-helper`} className="input-helper">
          {helper}
        </p>
      )}
      {error && (
        <p className="input-helper text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export function Textarea({ label, helper, error, id, className = "", ...props }: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? `textarea-${generatedId.replace(/:/g, "")}`;
  return (
    <div className="input-wrap">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`textarea ${error ? "border-red-500/50" : ""} ${className}`.trim()}
        aria-invalid={!!error}
        aria-describedby={helper ? `${inputId}-helper` : undefined}
        {...props}
      />
      {helper && !error && (
        <p id={`${inputId}-helper`} className="input-helper">
          {helper}
        </p>
      )}
      {error && (
        <p className="input-helper text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
