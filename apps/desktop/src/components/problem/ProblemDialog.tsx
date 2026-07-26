import { type ReactNode, useId } from "react";
import "./ProblemDialog.css";

export interface ProblemDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function ProblemDialog({ title, onClose, children, className = "" }: ProblemDialogProps) {
  const titleId = useId();

  return (
    <div className="problem-dialog-layer">
      <button
        className="problem-dialog-layer__backdrop"
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={`problem-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <h2 id={titleId} className="problem-dialog__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
