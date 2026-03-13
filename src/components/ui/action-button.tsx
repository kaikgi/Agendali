import * as React from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type ActionState = "idle" | "loading" | "success" | "error";

interface ActionButtonProps {
  /** Async handler — manages loading/success/error states automatically */
  onClick?: () => Promise<void> | void;
  /** Override internal loading state (for external control) */
  loading?: boolean;
  /** Label shown during loading */
  loadingLabel?: string;
  /** Label shown on success (brief flash) */
  successLabel?: string;
  /** Duration (ms) the success state is shown */
  successDuration?: number;
  /** Icon shown in idle state (before the label) */
  icon?: React.ReactNode;
  /** Button size variant */
  size?: "default" | "sm" | "lg" | "xl" | "icon";
  /** Button style variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "hero" | "premium" | "subtle";
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  type?: "button" | "submit" | "reset";
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      children,
      onClick,
      loading: externalLoading,
      loadingLabel,
      successLabel = "Salvo",
      successDuration = 2000,
      icon,
      disabled,
      variant = "default",
      size = "default",
      className,
      type = "button",
    },
    ref
  ) => {
    const [state, setState] = React.useState<ActionState>("idle");
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

    React.useEffect(() => {
      if (externalLoading === true) {
        setState("loading");
      } else if (externalLoading === false && state === "loading") {
        setState("success");
        timeoutRef.current = setTimeout(() => setState("idle"), successDuration);
      }
    }, [externalLoading]);

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);


    const handleClick = async () => {
      if (!onClick || state === "loading" || state === "success") return;

      setState("loading");
      const startTime = Date.now();
      try {
        await onClick();
        // Ensure at least 4 seconds of loading animation
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 4000 - elapsed);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
        setState("success");
        
        timeoutRef.current = setTimeout(() => setState("idle"), successDuration);
      } catch {
        setState("error");
        timeoutRef.current = setTimeout(() => setState("idle"), 2000);
      }
    };

    const isLoading = state === "loading";
    const isSuccess = state === "success";
    const isError = state === "error";

    const sizeClasses: Record<string, string> = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-9 px-3 text-xs",
      lg: "h-12 px-6 text-base",
      xl: "h-14 px-8 text-base font-semibold",
      icon: "h-10 w-10",
    };

    const motionVariants = {
      idle: { scale: 1 },
      saving: { scale: 1 },
      saved: {
        scale: [1, 1.08, 1],
        transition: { duration: 0.3, times: [0, 0.5, 1] },
      },
    };

    return (
      <div className="relative inline-flex">
        <motion.button
          ref={ref}
          disabled={disabled || isLoading}
          onClick={handleClick}
          animate={isSuccess ? "saved" : isLoading ? "saving" : "idle"}
          variants={motionVariants}
          whileHover={state === "idle" && !disabled ? { scale: 1.03 } : {}}
          whileTap={state === "idle" && !disabled ? { scale: 0.97 } : {}}
          className={cn(
            "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-300 overflow-hidden",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
            sizeClasses[size],
            // State-based styles
            isSuccess
              ? "bg-success text-success-foreground shadow-lg"
              : isError
                ? "bg-destructive text-destructive-foreground"
                : isLoading
                  ? "bg-primary text-primary-foreground shadow-md"
                  : // idle variant styles
                    variant === "default" ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" :
                    variant === "destructive" ? "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90" :
                    variant === "outline" ? "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground" :
                    variant === "secondary" ? "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80" :
                    variant === "ghost" ? "hover:bg-accent hover:text-accent-foreground" :
                    variant === "link" ? "text-primary underline-offset-4 hover:underline" :
                    variant === "hero" ? "bg-foreground text-background shadow-lg hover:bg-foreground/90" :
                    variant === "premium" ? "bg-foreground text-background shadow-lg hover:bg-foreground/90" :
                    variant === "subtle" ? "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground" :
                    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
            className
          )}
          type={type}
        >
          {/* Spark border effect - idle only */}
          {state === "idle" && (variant === "default" || variant === "hero" || variant === "premium") && (
            <span>
              <span
                className={cn(
                  "spark mask-gradient absolute inset-0 h-full w-full animate-flip overflow-hidden rounded-lg",
                  "[mask:linear-gradient(black,_transparent_50%)]",
                  "before:absolute before:aspect-square before:w-[200%] before:bg-[conic-gradient(from_0deg,transparent_0_340deg,hsl(var(--primary))_360deg)]",
                  "before:rotate-[-90deg] before:animate-rotate",
                  "before:content-[''] before:[inset:0_auto_auto_50%] before:[translate:-50%_-15%]",
                  "dark:[mask:linear-gradient(white,_transparent_50%)]",
                  "dark:before:bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)]",
                )}
              />
            </span>
          )}

          {/* Backdrop */}
          {state === "idle" && (variant === "default" || variant === "hero" || variant === "premium") && (
            <span className="backdrop absolute inset-px rounded-[calc(var(--radius)-1px)] bg-primary transition-colors duration-200" />
          )}

          {/* Content */}
          <span className="z-10 flex items-center justify-center gap-2">
            <AnimatePresence mode="wait">
              {isLoading && (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0, rotate: 0 }}
                  animate={{ opacity: 1, rotate: 360 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.3,
                    rotate: { repeat: Infinity, duration: 1, ease: "linear" },
                  }}
                >
                  <Loader2 className="h-4 w-4" />
                </motion.span>
              )}
              {isSuccess && (
                <motion.span
                  key="success"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Check className="h-4 w-4" />
                </motion.span>
              )}
              {isError && (
                <motion.span
                  key="error"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AlertCircle className="h-4 w-4" />
                </motion.span>
              )}
              {!isLoading && !isSuccess && !isError && icon && (
                <motion.span
                  key="icon"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {icon}
                </motion.span>
              )}
            </AnimatePresence>

            <motion.span
              key={state}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading
                ? (loadingLabel || children)
                : isSuccess
                  ? successLabel
                  : children}
            </motion.span>
          </span>
        </motion.button>

        {/* Sparkle icon on success */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              className="absolute -top-1 -right-1 pointer-events-none"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            >
              <Sparkles className="w-5 h-5 text-warning" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

ActionButton.displayName = "ActionButton";

export { ActionButton };
export type { ActionButtonProps };
