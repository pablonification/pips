/**
 * The room's composer (garis/screens-more.js `scrRoom`'s chat bar): the reply chip with Batal membalas, the field and
 * the gold Kirim pesan button. The field is a textarea that looks like the one-line field at rest and grows with its
 * text up to five lines; Enter follows the pointer (`enterAction`, SPEC story 98).
 */
import {
  useLayoutEffect,
  useRef,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { Button, IconButton } from '~/components/garis';
import { IconKirim } from '~/components/icons/kirim';
import { IconTutup } from '~/components/icons/tutup';
import { curhat as t } from '~/copy/curhat';
import { fill } from '~/copy/fill';
import { enterAction } from './rules';

/** Five lines of 24 px plus the field's padding: where the field stops growing and scrolls. */
const MAX_FIELD_PX = 140;

const coarsePointer = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

function fit(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  const full = el.scrollHeight > MAX_FIELD_PX;
  el.style.height = `${Math.min(el.scrollHeight, MAX_FIELD_PX)}px`;
  el.classList.toggle('full', full);
}

export function Composer({
  value,
  onChange,
  onSend,
  replyText,
  onCancelReply,
  field,
  banner,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Sends what is typed (empty text keeps focus in the field). */
  onSend: () => void;
  replyText: string | null;
  onCancelReply: () => void;
  field: RefObject<HTMLTextAreaElement | null>;
  /** Above the reply chip, in the bar that stays at the bottom: the lost-connection banner, where you send. */
  banner?: ReactNode;
}) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  const setRef: Ref<HTMLTextAreaElement> = (el) => {
    own.current = el;
    field.current = el;
  };
  useLayoutEffect(() => {
    if (own.current) fit(own.current);
  }, [value]);

  return (
    <form
      className="g-chat-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      {banner}
      {replyText !== null ? (
        <div className="g-reply-chip">
          <span className="line-clamp-1 min-w-0 flex-1">
            {fill(t.ruang.membalas, { pesan: replyText })}
          </span>
          <IconButton
            size="sm"
            label={t.ruang.batalMembalas}
            onClick={onCancelReply}
          >
            <IconTutup size={16} />
          </IconButton>
        </div>
      ) : null}
      <div className="g-composer">
        <textarea
          ref={setRef}
          className="g-field"
          name="msg"
          rows={1}
          placeholder={t.ruang.tulis}
          aria-label={t.ruang.tulisLabel}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            const action = enterAction({
              key: e.key,
              shiftKey: e.shiftKey,
              isComposing: e.nativeEvent.isComposing,
              coarse: coarsePointer(),
            });
            if (action === 'send') {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button variant="gold" square type="submit" aria-label={t.ruang.kirim}>
          <IconKirim size={16} />
        </Button>
      </div>
    </form>
  );
}
