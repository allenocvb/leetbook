import { useEffect, useMemo, useRef } from "react";
import { filterSlashCommands, type SlashCommand } from "./slashCommands.js";

export interface SlashMenuState {
  from: number;
  to: number;
  query: string;
  left: number;
  top: number;
}

interface SlashCommandMenuProps {
  state: SlashMenuState;
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
}

export function SlashCommandMenu({ state, activeIndex, onSelect, onHover }: SlashCommandMenuProps) {
  const items = useMemo(() => filterSlashCommands(state.query), [state.query]);
  const menu = useRef<HTMLDivElement | null>(null);

  /*
   * Keep the active item visible by hand rather than with scrollIntoView, which walks
   * every scrollable ancestor and used to yank the whole notes page around. This touches
   * only the menu's own scrollTop, and no-ops when the item is already visible — always
   * true for a hovered item, so the pointer never fights the scroll position.
   *
   * The row is looked up by index instead of held in a ref so that both dependencies are
   * genuinely read here: a ref read is invisible to the exhaustive-deps rule, which would
   * then push us toward empty deps and an effect that only ever runs on mount.
   */
  useEffect(() => {
    const list = menu.current;
    if (!list || activeIndex >= items.length) return;

    const item = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!item) return;

    const itemBottom = item.offsetTop + item.offsetHeight;
    if (item.offsetTop < list.scrollTop) {
      list.scrollTop = item.offsetTop;
    } else if (itemBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = itemBottom - list.clientHeight;
    }
  }, [activeIndex, items]);

  if (items.length === 0) return null;

  return (
    <div
      id="note-editor-slash-menu"
      ref={menu}
      className="slash-command-menu"
      role="listbox"
      aria-label="Block types"
      style={{ left: state.left, top: state.top }}
    >
      <div className="slash-command-menu__label">Insert block</div>
      {items.map((item, index) => (
        <button
          key={item.id}
          id={`slash-command-${item.id}`}
          className="slash-command-menu__item"
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          tabIndex={-1}
          data-index={index}
          data-active={index === activeIndex ? "true" : undefined}
          onMouseEnter={() => onHover(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(item);
          }}
        >
          <span className="slash-command-menu__badge" aria-hidden="true">
            {item.badge}
          </span>
          <span>
            <span className="slash-command-menu__name">{item.label}</span>
            <span className="slash-command-menu__description">{item.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
