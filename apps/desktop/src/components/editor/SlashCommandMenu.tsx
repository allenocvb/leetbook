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
}

export function SlashCommandMenu({ state, activeIndex, onSelect }: SlashCommandMenuProps) {
  const items = useMemo(() => filterSlashCommands(state.query), [state.query]);
  const activeItem = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeItem.current?.scrollIntoView?.({ block: "nearest" });
  });

  if (items.length === 0) return null;

  return (
    <div
      id="note-editor-slash-menu"
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
          ref={index === activeIndex ? activeItem : null}
          className="slash-command-menu__item"
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          tabIndex={-1}
          data-active={index === activeIndex ? "true" : undefined}
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
