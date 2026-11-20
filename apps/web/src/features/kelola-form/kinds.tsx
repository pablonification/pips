import type { ReactNode } from 'react';
import { IconDropdown } from '~/components/icons/dropdown';
import { IconJam } from '~/components/icons/jam';
import { IconKalender } from '~/components/icons/kalender';
import { IconKotak } from '~/components/icons/kotak';
import { IconParagraf } from '~/components/icons/paragraf';
import { IconRadio } from '~/components/icons/radio';
import { IconSkala } from '~/components/icons/skala';
import { IconTeks } from '~/components/icons/teks';
import { IconUnggah } from '~/components/icons/unggah';
import { kelolaForm as copy } from '~/copy/kelola-form';
import type { QuestionKind } from './rules';

/** Each kind of question's icon, at a size. */
export function KindIcon({
  kind,
  size,
}: {
  kind: QuestionKind;
  size: 16 | 20;
}) {
  const icons: Record<QuestionKind, ReactNode> = {
    text: <IconTeks size={size} />,
    textarea: <IconParagraf size={size} />,
    radio: <IconRadio size={size} />,
    checkbox: <IconKotak size={size} />,
    dropdown: <IconDropdown size={size} />,
    rating: <IconSkala size={size} />,
    date: <IconKalender size={size} />,
    time: <IconJam size={size} />,
    file: <IconUnggah size={size} />,
  };
  return icons[kind];
}

export const kindName = (kind: QuestionKind) => copy.jenis[kind];
