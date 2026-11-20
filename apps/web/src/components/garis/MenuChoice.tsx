import * as DM from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { IconCentang } from '~/components/icons/centang';
import { rememberMenuOpener } from './menu-opener';

/*
 * A menu offering one choice among several (a question's kind, a person's access), built on the menu's plain item
 * rather than Radix's radio group: those parts of Radix would ride in the chunk every page loads, for one screen.
 */

/** A line between groups of items. */
export function MenuSeparator() {
  return <div role="separator" aria-orientation="horizontal" />;
}

/** The choices inside, each a MenuRadioItem: the chosen one is ticked and read as checked. */
export function MenuRadioGroup({
  label,
  children,
}: {
  /** What the group chooses, for screen readers ("Jenis pertanyaan"). */
  label?: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function MenuRadioItem({
  checked,
  onSelect,
  children,
  icon,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <DM.Item
      role="menuitemradio"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      onSelect={(e) => {
        rememberMenuOpener(e.currentTarget as Element | null);
        onSelect();
      }}
    >
      {icon}
      <span>
        {children}
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
      {checked ? (
        <span className="ck">
          <IconCentang size={16} />
        </span>
      ) : null}
    </DM.Item>
  );
}
