/**
 * The colour palette offered by the selection toolbar.
 *
 * Values are `var(...)` references rather than literal hex. TipTap writes them straight into
 * the element's `style` attribute and parses them back out of the raw attribute string, so
 * they survive a round trip through the stored document — which means a note coloured in
 * light mode resolves against the dark tokens when the theme changes, instead of freezing as
 * whatever hex happened to be current when it was written.
 */
export interface NoteColor {
  /** Shown in the toolbar and read by screen readers. */
  readonly name: string;
  /** The CSS value written to the document. */
  readonly value: string;
}

export const TEXT_COLORS: readonly NoteColor[] = [
  { name: "Purple", value: "var(--lb-note-purple)" },
  { name: "Blue", value: "var(--lb-note-blue)" },
  { name: "Green", value: "var(--lb-note-green)" },
  { name: "Amber", value: "var(--lb-note-amber)" },
  { name: "Red", value: "var(--lb-note-red)" },
];

export const HIGHLIGHT_COLORS: readonly NoteColor[] = [
  { name: "Purple", value: "var(--lb-mark-purple)" },
  { name: "Blue", value: "var(--lb-mark-blue)" },
  { name: "Green", value: "var(--lb-mark-green)" },
  { name: "Amber", value: "var(--lb-mark-amber)" },
  { name: "Red", value: "var(--lb-mark-red)" },
];
