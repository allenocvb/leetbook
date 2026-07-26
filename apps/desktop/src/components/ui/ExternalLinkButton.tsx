import { type ButtonHTMLAttributes, useId, useState } from "react";
import { openLeetCodeUrl } from "../../lib/externalLinks.js";
import "./ExternalLinkButton.css";

export interface ExternalLinkButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  url: string;
  opener?: (url: string) => Promise<void>;
}

export function ExternalLinkButton({
  url,
  opener = openLeetCodeUrl,
  children,
  className,
  ...button
}: ExternalLinkButtonProps) {
  const errorId = useId();
  const [error, setError] = useState(false);

  const handleClick = async () => {
    setError(false);
    try {
      await opener(url);
    } catch {
      setError(true);
    }
  };

  return (
    <span className="external-link-control">
      <button
        {...button}
        type="button"
        className={className}
        aria-describedby={error ? errorId : undefined}
        onClick={() => void handleClick()}
      >
        {children}
      </button>
      {error && (
        <span id={errorId} className="external-link-control__error" role="alert">
          Couldn’t open LeetCode.
        </span>
      )}
    </span>
  );
}
