/* eslint-disable tailwindcss/no-custom-classname */
import { Link, LinkProps } from '@tanstack/react-router';
import QuestionMarkIcon from '../icons/question-mark';

function BottomNavigationItem({
  Icon,
  alt,
  title,
  to,
}: {
  Icon: typeof QuestionMarkIcon;
  alt: string;
  title: string;
  to: LinkProps['to'];
}) {
  return (
    <Link
      className={`flex w-18.25 flex-col items-center justify-center rounded-full`}
      to={to}
      activeProps={{
        className:
          'font-bold text-green-300 [&>svg]:fill-green-300 [&>svg]:stroke-neutral-light',
      }}
      // `alt` isn't an anchor attribute and the router types now say so; kept so the markup stays the same.
      {...{ alt }}
    >
      <Icon className="active-icon size-10.5 fill-transparent stroke-black transition-colors duration-200" />
      <span className={`text-[0.625rem]`}>{title}</span>
    </Link>
  );
}

export default BottomNavigationItem;
