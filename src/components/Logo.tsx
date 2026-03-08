import { cn } from "@/lib/utils";
import logoPrincipal from "@/assets/logo-principal.png";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  // Heights tuned per context:
  // sm  → sidebar / compact areas (36px)
  // md  → header / navbar (44px)
  // lg  → hero / landing prominent (64px)
  const pixelHeights: Record<string, number> = {
    sm: 44,
    md: 54,
    lg: 80,
  };

  const iconSizes: Record<string, string> = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };

  const h = pixelHeights[size];

  if (showText) {
    return (
      <div className={cn("flex items-center", className)}>
        <img
          src={logoPrincipal}
          alt="Agendali"
          className="object-contain"
          style={{ height: h, width: 'auto' }}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <img
        src="/logo-512.png"
        alt="Agendali"
        className={cn("object-contain rounded-lg", iconSizes[size])}
        draggable={false}
      />
    </div>
  );
}
