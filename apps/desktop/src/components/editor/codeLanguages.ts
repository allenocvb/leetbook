import { common, createLowlight } from "lowlight";

export const codeLowlight = createLowlight(common);

export interface CodeLanguage {
  value: string;
  label: string;
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { value: "", label: "Auto detect" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "plaintext", label: "Plain text" },
];

const LANGUAGE_ALIASES: Record<string, string> = {
  "c++": "cpp",
  "c#": "csharp",
  golang: "go",
  js: "javascript",
  nodejs: "javascript",
  py: "python",
  python3: "python",
  ts: "typescript",
};

const SUPPORTED_LANGUAGES = new Set(codeLowlight.listLanguages());

export function normalizeCodeLanguage(language: string | null | undefined): string | null {
  const requested = language?.trim().toLowerCase();
  if (!requested) return null;
  const normalized = LANGUAGE_ALIASES[requested] ?? requested;
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : null;
}

export function codeLanguageLabel(language: string | null | undefined): string {
  const normalized = normalizeCodeLanguage(language);
  if (!normalized) return language?.trim() || "Code";
  return CODE_LANGUAGES.find((option) => option.value === normalized)?.label ?? normalized;
}
