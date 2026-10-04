import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, ReactNode } from 'react';

/**
 * Отображает текст с формулами: фрагменты в знаках $...$ рендерятся как LaTeX (KaTeX),
 * остальной текст остаётся обычным. Незакрытый $ выводится как есть.
 *
 * Безопасность: KaTeX экранирует HTML в вводе (trust: false по умолчанию),
 * поэтому dangerouslySetInnerHTML применяется только к его выводу.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{renderSegments(text)}</span>;
}

function renderSegments(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\$([^$]+)\$/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<Fragment key={key++}>{text.slice(last, match.index)}</Fragment>);
    }
    const html = katex.renderToString(match[1], {
      throwOnError: false,
      displayMode: false,
      output: 'html',
    });
    nodes.push(
      <span
        key={key++}
        className="katex-inline align-middle"
        dangerouslySetInnerHTML={{ __html: html }}
      />,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  }
  return nodes;
}
