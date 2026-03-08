import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  const iconSizes: Record<string, string> = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const textSizes: Record<string, string> = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-primary rounded-lg p-1.5">
        <Calendar className={cn("text-primary-foreground", iconSizes[size])} />
      </div>
      {showText && (
        <span className={cn("font-bold tracking-tight text-foreground", textSizes[size])}>
          Agendali
        </span>
      )}
    </div>
  );
}
