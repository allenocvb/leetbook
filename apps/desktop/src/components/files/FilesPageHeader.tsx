import type { ReactNode } from "react";
import { Button } from "../ui/Button.js";

export function FilesPageHeader(props: {
  query: string;
  busy: boolean;
  error: string;
  onQuery: (query: string) => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  onNewFolder: () => void;
  /** The breadcrumb trail, shown under the title row. */
  children: ReactNode;
}) {
  return (
    <header className="problems-header">
      <div className="problems-header__top">
        <div className="problems-header__copy">
          <h1>Files & Notes</h1>
          <div className="problems-header__subtitle">
            Your reference shelf, saved on this device.
          </div>
        </div>
        <div className="problems-header__actions">
          <div className="problems-header__search">
            <input
              type="search"
              aria-label="Search files"
              placeholder="Search files"
              value={props.query}
              onChange={(event) => props.onQuery(event.target.value)}
            />
          </div>
          <Button variant="ghost" disabled={props.busy} onClick={props.onNewFolder}>
            New folder
          </Button>
          <Button variant="ghost" disabled={props.busy} onClick={props.onUploadFolder}>
            Upload folder
          </Button>
          <Button disabled={props.busy} onClick={props.onUploadFiles}>
            {props.busy ? "Saving…" : "+ Upload files"}
          </Button>
        </div>
      </div>
      <div className="files-page__toolbar">
        {props.children}
        <p className="files-page__hint">
          Drop files or folders here · Double-click to open · ⌥↑/↓ reorders · Up to 100 MB per file
        </p>
      </div>
      {props.error && (
        <p className="files-page__error" role="alert">
          {props.error}
        </p>
      )}
    </header>
  );
}
