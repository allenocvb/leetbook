import { CODE_LANGUAGES, codeLanguageLabel, normalizeCodeLanguage } from "./codeLanguages.js";

export interface CodeLanguagePicker {
  /** The trigger and its popover; append to the code block's header. */
  element: HTMLElement;
  /** Reflect a language changed elsewhere (undo, paste, a collaborator's edit). */
  setValue(language: string | null): void;
  destroy(): void;
}

const CHEVRON =
  '<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 3 4 5.5 6.5 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function labelFor(language: string | null): string {
  return language ? codeLanguageLabel(language) : "Auto detect";
}

/**
 * Notion-style language control for an editable code block: a quiet text button that opens a
 * searchable list. Plain DOM because it lives inside the code block's plain DOM node view.
 */
export function createCodeLanguagePicker(
  initial: string | null,
  onChange: (language: string | null) => void,
  onClose: () => void,
): CodeLanguagePicker {
  let value = normalizeCodeLanguage(initial);
  let active = 0;
  let visible = CODE_LANGUAGES;

  const element = document.createElement("div");
  element.className = "code-language";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "code-language__trigger";
  trigger.setAttribute("aria-label", "Code language");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const triggerLabel = document.createElement("span");
  trigger.append(triggerLabel);
  trigger.insertAdjacentHTML("beforeend", CHEVRON);

  const menu = document.createElement("div");
  menu.className = "code-language__menu";
  menu.hidden = true;

  const search = document.createElement("input");
  search.type = "text";
  search.className = "code-language__search";
  search.placeholder = "Search for a language…";
  search.setAttribute("aria-label", "Search languages");
  search.setAttribute("autocomplete", "off");
  search.spellcheck = false;

  const list = document.createElement("div");
  list.className = "code-language__list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Languages");
  list.id = `code-language-${Math.random().toString(36).slice(2, 9)}`;
  search.setAttribute("aria-controls", list.id);

  menu.append(search, list);
  element.append(trigger, menu);

  const render = () => {
    triggerLabel.textContent = labelFor(value);
    list.replaceChildren(
      ...visible.map((option, index) => {
        const row = document.createElement("div");
        row.className = "code-language__option";
        row.setAttribute("role", "option");
        row.id = `${list.id}-${index}`;
        row.textContent = option.label;
        row.setAttribute("aria-selected", String(index === active));
        if ((option.value || null) === value) row.dataset.current = "true";
        // Keep focus in the search field so typing keeps filtering.
        row.addEventListener("mousedown", (event) => event.preventDefault());
        row.addEventListener("mousemove", () => {
          if (active === index) return;
          active = index;
          render();
        });
        row.addEventListener("click", () => choose(option.value || null));
        return row;
      }),
    );
    if (visible.length === 0) {
      const empty = document.createElement("div");
      empty.className = "code-language__empty";
      empty.textContent = "No matching language";
      list.append(empty);
      search.removeAttribute("aria-activedescendant");
    } else {
      search.setAttribute("aria-activedescendant", `${list.id}-${active}`);
      const row = list.children[active] as HTMLElement | undefined;
      // Scroll the list only — scrollIntoView would drag the notes page along with it.
      if (row && typeof row.offsetTop === "number") {
        if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
        else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight)
          list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
      }
    }
  };

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    visible = CODE_LANGUAGES.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query),
    );
    active = 0;
    render();
  };

  const outside = (event: MouseEvent) => {
    if (!element.contains(event.target as Node)) close(false);
  };

  const open = () => {
    search.value = "";
    visible = CODE_LANGUAGES;
    active = Math.max(
      0,
      visible.findIndex((option) => (option.value || null) === value),
    );
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    element.dataset.open = "true";
    render();
    search.focus();
    document.addEventListener("mousedown", outside, true);
  };

  function close(returnFocus: boolean) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    delete element.dataset.open;
    document.removeEventListener("mousedown", outside, true);
    if (returnFocus) onClose();
  }

  function choose(language: string | null) {
    value = language;
    render();
    close(true);
    onChange(language);
  }

  trigger.addEventListener("mousedown", (event) => event.preventDefault());
  trigger.addEventListener("click", () => (menu.hidden ? open() : close(true)));
  search.addEventListener("input", filter);
  search.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visible.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = (active + step + visible.length) % visible.length;
      render();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[active];
      if (option) choose(option.value || null);
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close(true);
    }
  });

  render();

  return {
    element,
    setValue(language) {
      const next = normalizeCodeLanguage(language);
      if (next === value) return;
      value = next;
      render();
    },
    destroy() {
      document.removeEventListener("mousedown", outside, true);
    },
  };
}
