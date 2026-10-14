/**
 * Global search (the prototype's `#palette` dialog and `renderPal`): a field, the results in groups, and on
 * desktop the key hints. cmdk gives the keyboard: arrows move through the results, Enter opens the chosen one
 * (the first, until you move), Escape closes. Loaded on demand the first time search opens.
 */
import * as D from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { useMemo, useState } from 'react';
import { ICONS } from '~/components/icons/registry';
import { IconCari } from '~/components/icons/cari';
import { common } from '~/copy/common';
import { fill } from '~/copy/fill';
import { chosenResult } from '~/features/cari/rules';
import { paletteResults, type PaletteItem } from '~/lib/shell/palette';
import { closePalette, closePaletteAfterRun } from './palette-store';
import { usePaletteItems } from './sources';

const t = common.palette;

export default function Palette() {
  const [query, setQuery] = useState('');
  const { items, pending } = usePaletteItems(query);
  const groups = useMemo(
    () => paletteResults(items, query, t.pintasan),
    [items, query],
  );
  // The highlight follows the first result (results from the API can arrive above it) until the member moves it.
  const [moved, setMoved] = useState<string | null>(null);
  const chosen = chosenResult(
    moved,
    groups.flatMap((g) => g.items.map((i) => i.id)),
  );
  // A new query starts at its first result again.
  const [forQuery, setForQuery] = useState(query);
  if (forQuery !== query) {
    setForQuery(query);
    setMoved(null);
  }

  const run = (item: PaletteItem) => {
    closePaletteAfterRun();
    item.run();
  };

  return (
    <D.Root open onOpenChange={(o) => !o && closePalette()}>
      <D.Portal>
        <D.Overlay className="g-palette-scrim" />
        <D.Content
          className="g-palette"
          aria-describedby={undefined}
          // The palette store returns focus itself: to the opener, or to the page an item opened.
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <D.Title className="sr-only">{common.shell.pencarianGlobal}</D.Title>
          <Command
            shouldFilter={false}
            value={chosen}
            onValueChange={(v) => {
              if (v && v !== chosen) setMoved(v);
            }}
          >
            <div className="g-pal-in">
              <IconCari size={18} />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={common.shell.cariPlaceholder}
                aria-label={common.shell.cariDiPips}
                autoComplete="off"
                spellCheck={false}
              />
              <D.Close className="g-pal-close">{common.actions.tutup}</D.Close>
            </div>
            {/* With no result the list leaves the accessibility tree (hidden): an empty listbox is an ARIA error
                (axe aria-required-children, F2-001), and the field's aria-controls still points at it. The words
                then show in the list's own box, so nothing on screen moves. */}
            <Command.List
              className="g-pal-res"
              label={t.hasil}
              hidden={groups.length === 0}
            >
              {groups.map((g) => (
                <Command.Group
                  key={g.heading}
                  heading={g.heading}
                  className="g-pal-g"
                >
                  {g.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    return (
                      <Command.Item
                        key={item.id}
                        value={item.id}
                        onSelect={() => run(item)}
                        className="g-pal-item"
                      >
                        <span className="c2">
                          <Icon size={17} />
                        </span>
                        <span className="label">{item.label}</span>
                        <small>{item.hint}</small>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
            {groups.length === 0 ? (
              <div className="g-pal-res">
                {/* Not while the API's results are on their way: that isn't "no results" yet. */}
                {!pending ? (
                  <div className="g-pal-empty" role="status">
                    <p className="t-sm">{fill(t.tidakAda, { kata: query })}</p>
                    <p className="t-sm text-fg-2" style={{ marginTop: 4 }}>
                      {t.coba}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="g-pal-foot" aria-hidden="true">
              <span>{t.pilih}</span>
              <span>{t.buka}</span>
              <span>{t.tutup}</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
