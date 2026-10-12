import type { DetailsHTMLAttributes, ReactNode } from 'react';
import { IconBawah } from '~/components/icons/bawah';
import { cn } from '~/lib/utils';

export interface DisclosureProps extends Omit<
  DetailsHTMLAttributes<HTMLDetailsElement>,
  'title'
> {
  /** Names what is inside ("Informasi akun"). */
  label: ReactNode;
  children: ReactNode;
}

/**
 * Secondary facts one tap away (garis.css `.disclosure`): a native details element with a 48 px summary row and a
 * chevron that turns. Pass `open` to open it when it is needed.
 */
export function Disclosure({
  label,
  className,
  children,
  ...rest
}: DisclosureProps) {
  return (
    <details className={cn('g-disclosure', className)} {...rest}>
      <summary>
        {label}
        <span className="dis-ic">
          <IconBawah size={16} />
        </span>
      </summary>
      {children}
    </details>
  );
}
