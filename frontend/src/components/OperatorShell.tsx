import type React from "react";
import { loadDeviceLayout } from "../services/deviceLayoutService";

interface OperatorShellProps {
  children: React.ReactNode;
  className?: string;
}

export function OperatorShell({ children, className = "" }: OperatorShellProps) {
  const layout = loadDeviceLayout();
  const isFixed = layout.mode !== "auto";
  const isCompact = isFixed && layout.width < 700;
  const style = isFixed
    ? ({
        "--operator-width": `${layout.width}px`,
        "--operator-min-height": `${layout.minHeight}px`
      } as React.CSSProperties)
    : undefined;

  return (
    <main className={`page operator-shell ${isFixed ? "device-framed" : ""} ${isCompact ? "compact-device" : ""} ${className}`} style={style}>
      {children}
    </main>
  );
}
