/**
 * Info Lomba's 3:4 poster and the poster viewer (Garis v5: garis/screens-more.js `scrLomba` and `OV.poster`,
 * garis/v5-layanan.css). The poster is a button that opens it large on a dark backdrop, in both themes.
 */
import * as RD from '@radix-ui/react-dialog';
import { useRef, useState } from 'react';
import type { Competition } from '~/api/generated';
import { IconButton, Media } from '~/components/garis';
import { IconTutup } from '~/components/icons/tutup';
import { fill } from '~/copy/fill';
import { lomba as copy } from '~/copy/lomba';
import { posterUrl } from './rules';

/** What the viewer shows: the competition's name and its poster. */
export interface Viewing {
  name: string;
  url: string;
}

/**
 * A competition's poster, from the API's first media. One that has none or fails to load keeps its 3:4 place as a
 * quiet muted panel (no broken-image icon), with nothing to open.
 */
export function Poster({
  c,
  onOpen,
}: {
  c: Competition;
  onOpen: (v: Viewing, opener: HTMLButtonElement) => void;
}) {
  const url = posterUrl(c);
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url)
    return <div className="g-poster" data-poster="none" aria-hidden="true" />;
  return (
    <button
      type="button"
      className="g-poster"
      aria-haspopup="dialog"
      aria-label={fill(copy.perbesarPoster, { nama: c.name })}
      onClick={(e) => onOpen({ name: c.name, url }, e.currentTarget)}
    >
      <Media
        src={url}
        alt={fill(copy.poster, { nama: c.name })}
        ratio="3 / 4"
        width={600}
        height={800}
        onError={() => setFailed(url)}
      />
    </button>
  );
}

/**
 * The viewer: the poster as large as the window allows, titled with the competition's name. Focus starts on Tutup
 * and stays inside; Tutup, Esc or a tap beside the poster closes it, and focus goes back to the poster opened.
 */
export function usePosterViewer() {
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const open = (v: Viewing, from: HTMLButtonElement) => {
    opener.current = from;
    setViewing(v);
  };
  const viewer = (
    <RD.Root
      open={!!viewing}
      onOpenChange={(o) => {
        if (!o) setViewing(null);
      }}
    >
      <RD.Portal>
        <RD.Overlay className="g-pv-ov" />
        <RD.Content
          className="g-pv"
          aria-modal="true"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            const el = opener.current;
            opener.current = null;
            if (el?.isConnected) {
              e.preventDefault();
              el.focus();
            }
          }}
          // The layout fills the window; a tap anywhere but the poster and the head is a tap on the backdrop.
          onClick={(e) => {
            const t = e.target as Element;
            if (!t.closest('img, .g-pv-head')) setViewing(null);
          }}
        >
          {viewing ? (
            <>
              <div className="g-pv-head">
                <RD.Title asChild>
                  <h2 className="line-clamp-2 t-sub">{viewing.name}</h2>
                </RD.Title>
                <RD.Close asChild>
                  <IconButton label={copy.tutupPoster}>
                    <IconTutup size={24} />
                  </IconButton>
                </RD.Close>
              </div>
              <div className="g-pv-img">
                <Media
                  src={viewing.url}
                  alt={fill(copy.poster, { nama: viewing.name })}
                  ratio="auto"
                />
              </div>
            </>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
  return { open, viewer };
}
