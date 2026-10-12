import type { JSX } from 'react';
import { extractUrls } from '~/lib/url-parser';
import { renderInfoContent } from '~/routes/_app/_left-navbar/timeline/$infoId/-helper';

type ComponentProps = {
  title: string;
  content: string;
};

export default function TestiContent({
  title,
  content,
}: ComponentProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-sm font-bold whitespace-pre-line">{title}</h2>
      <p className="text-sm wrap-break-word whitespace-pre-line">
        {renderInfoContent('', content, extractUrls(content))}
      </p>
    </div>
  );
}
