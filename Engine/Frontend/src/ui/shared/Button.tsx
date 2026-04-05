import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
  }
>;

const variantMap = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
} as const;

const sizeMap = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
} as const;

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const variantClass = variantMap[variant];
  const sizeClass = sizeMap[size];

  return (
    <button
      className={`${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
