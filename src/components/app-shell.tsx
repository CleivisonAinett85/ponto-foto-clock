import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, Home, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useAppearance } from "@/hooks/use-appearance";
import { blendedBackground, isLightColor, LIGHT_THEME_VARS } from "@/lib/ponto-storage";

const NAV = [
  { to: "/", label: "Hoje", icon: Home },
  { to: "/calendario", label: "Calendário", icon: Calendar },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const appearance = useAppearance();

  const isColor = appearance.mode === "color";
  const opacity = appearance.opacity ?? 40;
  const light = isColor && isLightColor(appearance.color, opacity);

  const rootStyle: React.CSSProperties | undefined = isColor
    ? {
        backgroundColor: blendedBackground(appearance.color, opacity),
        ...(light
          ? {
              ["--foreground" as string]: "oklch(0.18 0.01 260)",
              ["--card-foreground" as string]: "oklch(0.18 0.01 260)",
              ["--popover-foreground" as string]: "oklch(0.18 0.01 260)",
              ["--muted-foreground" as string]: "oklch(0.42 0.02 260)",
              ["--card" as string]: "oklch(1 0 0 / 55%)",
              ["--popover" as string]: "oklch(1 0 0 / 92%)",
              ["--border" as string]: "oklch(0.18 0.01 260 / 20%)",
            }
          : {}),
      }
    : appearance.mode === "image" && appearance.image
      ? { backgroundColor: "#000" }
      : appearance.theme === "light"
        ? (LIGHT_THEME_VARS as React.CSSProperties)
        : undefined;


  return (
    <div
      className={`relative min-h-screen text-foreground flex flex-col ${
        appearance.mode === "default" ? "bg-background" : ""
      }`}
      style={rootStyle}
    >
      {appearance.mode === "image" && appearance.image && (
        <>
          <img
            aria-hidden
            src={appearance.image}
            alt=""
            className="fixed inset-0 w-full h-full object-contain pointer-events-none"
          />
          <div
            aria-hidden
            className="fixed inset-0 bg-black/55 pointer-events-none"
          />
        </>
      )}
      <main className="relative flex-1 pb-24 max-w-md w-full mx-auto">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card/95 backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}