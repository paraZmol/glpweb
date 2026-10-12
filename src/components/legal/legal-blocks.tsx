import type { InlineRun, LegalBlock } from '@/domain/legal/legal-markdown';
import { plainText } from '@/domain/legal/legal-markdown';

/** Text with its bold parts. Built as elements: nothing from the document is injected as HTML. */
function Runs({ runs }: { runs: InlineRun[] }) {
  return (
    <>
      {runs.map((run, index) =>
        run.strong ? (
          <strong key={index} className="font-bold">
            {run.text}
          </strong>
        ) : (
          run.text
        ),
      )}
    </>
  );
}

type TableBlock = Extract<LegalBlock, { kind: 'table' }>;

/** Phone: each row becomes a card with its column names, so nothing scrolls sideways. */
function StackedTable({ header, rows }: TableBlock) {
  return (
    <ul className="flex flex-col gap-3 sm:hidden">
      {rows.map((row, rowIndex) => (
        <li key={rowIndex} className="rounded-lg bg-muted p-4">
          <dl className="flex flex-col gap-2">
            {row.map((cell, cellIndex) => (
              <div key={cellIndex}>
                <dt className="text-[0.8125rem] font-semibold text-muted-foreground">
                  {plainText(header[cellIndex] ?? [])}
                </dt>
                <dd>
                  <Runs runs={cell} />
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function WideTable({ header, rows }: TableBlock) {
  return (
    <table className="hidden w-full border-collapse text-left text-[0.9375rem] sm:table">
      <thead>
        <tr className="border-b-2">
          {header.map((cell, index) => (
            <th key={index} scope="col" className="py-2.5 pr-4 align-bottom font-bold">
              <Runs runs={cell} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="py-2.5 pr-4 align-top">
                <Runs runs={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'heading': {
      const Heading = block.level === 2 ? 'h2' : 'h3';
      const size = block.level === 2 ? 'mt-6 text-2xl font-extrabold' : 'mt-2 text-xl font-bold';
      return (
        <Heading id={block.id} className={`scroll-mt-24 ${size}`}>
          {block.text}
        </Heading>
      );
    }
    case 'paragraph':
      return (
        <p>
          <Runs runs={block.runs} />
        </p>
      );
    case 'note':
      return (
        <p className="rounded-lg bg-muted p-4 text-[0.9375rem]">
          <Runs runs={block.runs} />
        </p>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      const marker = block.ordered ? 'list-decimal' : 'list-disc';
      return (
        <List className={`flex flex-col gap-2 pl-6 ${marker}`}>
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              <Runs runs={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'table':
      return (
        <>
          <StackedTable {...block} />
          <WideTable {...block} />
        </>
      );
  }
}

/** Body of a legal document, read from `parseLegalDocument`. */
export function LegalBlocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
