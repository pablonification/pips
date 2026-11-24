import { Link } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import {
  Button,
  DESKTOP_QUERY,
  Halftone,
  useMediaQuery,
  Wordmark,
} from '~/components/garis';
import { tautan as copy } from '~/copy/tautan';
import { common } from '~/copy/common';
import { Address } from './parts';
import './tautan.css';

/**
 * s.hmif.dev/<a name no link has>: the gold band with the PIPS! wordmark, "Tautan tidak ditemukan", the address as it
 * was typed, and "Buka PIPS!". No sign-in and no app around it, so anyone who followed a wrong link can read it.
 */
export function NotFoundPage({ name }: { name: string }) {
  const desk = useMediaQuery(DESKTOP_QUERY);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${copy.tidakDitemukan.judul} · ${common.app.name}`;
    title.current?.focus();
  }, []);
  return (
    <div className="sl-out">
      <header className="sl-out-band">
        <Halftone length={desk ? 1440 : 420} />
        <span className="sl-out-mark">
          <Wordmark size={desk ? 24 : 20} />
        </span>
      </header>
      <main className="sl-out-main">
        <h1
          ref={title}
          tabIndex={-1}
          className={desk ? 't-display-l' : 't-display'}
        >
          {copy.tidakDitemukan.judul}
        </h1>
        {name ? (
          <p className="sl-url sl-out-url">
            <Address name={name} />
          </p>
        ) : null}
        <p className="t-body text-fg-2">{copy.tidakDitemukan.ejaan}</p>
        <Button variant="gold" asChild>
          <Link to="/layanan/tautan">{copy.tidakDitemukan.bukaPips}</Link>
        </Button>
      </main>
    </div>
  );
}
