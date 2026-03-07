"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const themes = ["light", "dark", "system"] as const;

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const themeLabels = {
  light: "Light mode",
  dark: "Dark mode",
  system: "System theme",
} as const;

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface ThemeToggleProps {
  variant?: "default" | "sidebar";
  className?: string;
}

export function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)} disabled>
        <Monitor className="h-4 w-4" />
      </Button>
    );
  }

  const currentTheme = (theme ?? "system") as (typeof themes)[number];
  const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
  const Icon = themeIcons[currentTheme];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label={`${themeLabels[currentTheme]}. Click to switch to ${themeLabels[nextTheme]}`}
      className={cn(
        "h-9 w-9",
        variant === "sidebar" &&
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
