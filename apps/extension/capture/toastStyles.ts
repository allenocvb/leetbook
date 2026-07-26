export const CAPTURE_TOAST_STYLES = `
  :host {
    --lb-surf: #ffffff;
    --lb-surf-3: #f7f6fa;
    --lb-tint: #f1eefb;
    --lb-bd-2: #e8e6ee;
    --lb-ink: #191720;
    --lb-text-2: #33313c;
    --lb-text-3: #57545f;
    --lb-muted: #8b8896;
    --lb-muted-2: #a5a2b0;
    --lb-muted-3: #b3b0bd;
    --lb-accent: #6d4aff;
    --lb-accent-text: #5638d8;
    --lb-red: #a63b4c;
    --lb-shadow: 0 18px 40px rgba(25, 23, 32, 0.16);
  }

  :host([data-theme="dark"]) {
    --lb-surf: #18171d;
    --lb-surf-3: #212028;
    --lb-tint: #2a2340;
    --lb-bd-2: #2f2e3b;
    --lb-ink: #f2f1f6;
    --lb-text-2: #dcdae3;
    --lb-text-3: #a8a5b3;
    --lb-muted: #8b8896;
    --lb-muted-2: #7d7a89;
    --lb-muted-3: #6a6776;
    --lb-accent: #8b6bff;
    --lb-accent-text: #bda6ff;
    --lb-red: #e0808f;
    --lb-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
  }

  * { box-sizing: border-box; }
  button { color: inherit; font: inherit; }

  .card {
    position: fixed;
    right: 22px;
    bottom: 22px;
    z-index: 2147483000;
    width: 320px;
    padding: 15px 16px;
    color: var(--lb-ink);
    background: var(--lb-surf);
    border: 1px solid var(--lb-bd-2);
    border-radius: 11px;
    box-shadow: var(--lb-shadow);
    font-family: "Quicksand", "Helvetica Neue", sans-serif;
    font-size: 12px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .logo {
    width: 18px;
    height: 18px;
    display: grid;
    flex: 0 0 18px;
    place-items: center;
    color: var(--lb-surf);
    background: var(--lb-ink);
    border-radius: 5px;
    font-family: "Chewy", cursive;
    font-size: 11px;
  }

  .dot {
    width: 6px;
    height: 6px;
    background: var(--lb-accent);
    border-radius: 50%;
  }

  .dot--queued { background: var(--lb-muted-2); }
  .dot--sent { background: var(--lb-accent); }
  .dot--error { background: var(--lb-red); }

  .status {
    min-width: 0;
    color: var(--lb-text-2);
    font-size: 12px;
    font-weight: 600;
  }

  .dismiss {
    width: 26px;
    height: 26px;
    margin: -4px -6px -4px auto;
    padding: 0;
    color: var(--lb-muted-3);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
  }

  .dismiss:hover {
    color: var(--lb-accent-text);
    background: var(--lb-tint);
    border-color: var(--lb-bd-2);
  }

  .title {
    margin-top: 9px;
    color: var(--lb-ink);
    font-size: 13.5px;
    font-weight: 500;
  }

  .meta {
    margin-top: 4px;
    color: var(--lb-muted);
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 10.5px;
    line-height: 1.5;
  }

  .prompt {
    margin-top: 12px;
    color: var(--lb-text-3);
    font-size: 11.5px;
  }

  .scores {
    margin-top: 7px;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 5px;
  }

  .score {
    min-width: 0;
    height: 32px;
    padding: 0;
    color: var(--lb-text-2);
    background: transparent;
    border: 1px solid var(--lb-bd-2);
    border-radius: 6px;
    font-family: "Chewy", cursive;
    font-size: 16px;
    cursor: pointer;
    transition:
      background-color 100ms ease,
      border-color 100ms ease;
  }

  .score:hover:not(:disabled) {
    color: var(--lb-surf);
    background: var(--lb-accent);
    border-color: var(--lb-accent);
  }

  .score:disabled {
    color: var(--lb-muted-3);
    background: var(--lb-surf-3);
    cursor: default;
  }

  .feedback {
    margin-top: 9px;
    padding: 8px 9px;
    color: var(--lb-text-3);
    background: var(--lb-surf-3);
    border-radius: 6px;
    font-size: 10.5px;
    line-height: 1.45;
  }

  .feedback[hidden] { display: none; }
  .feedback--error { color: var(--lb-red); }

  .skip {
    margin-top: 10px;
    padding: 0;
    color: var(--lb-muted-2);
    background: transparent;
    border: 0;
    font-size: 10.5px;
    line-height: 1.45;
    text-align: left;
    cursor: pointer;
  }

  .skip:hover { color: var(--lb-accent-text); }

  button:focus-visible {
    outline: 2px solid var(--lb-accent);
    outline-offset: 2px;
  }
`;
