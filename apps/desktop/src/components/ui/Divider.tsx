import "./ui.css";

export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`ui-divider ${className}`.trim()} />;
}
