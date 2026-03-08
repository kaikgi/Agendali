import { cn } from "@/lib/utils";
import logoIcon from "@/assets/logo-icon.png";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  const iconSizes: Record<string, string> = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes: Record<string, string> = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={logoIcon}
        alt="Agendali"
        className={cn("object-contain rounded-lg", iconSizes[size])}
        draggable={false}
      />
      {showText && (
        <span className={cn("font-bold tracking-tight text-foreground", textSizes[size])}>
          Agendali
        </span>
      )}
    </div>
  );
}
