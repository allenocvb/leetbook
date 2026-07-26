import type { CSSProperties } from "react";
import "./ui.css";

interface LogoStyle extends CSSProperties {
  "--logo-size": string;
}

export function LogoMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  const style: LogoStyle = { "--logo-size": `${size}px` };

  return (
    <span className={`ui-logo ${className}`.trim()} style={style} aria-hidden="true">
      L
    </span>
  );
}
