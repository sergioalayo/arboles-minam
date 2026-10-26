import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import { TREES } from '@/data/trees';
import { normalize } from '@/lib/graph';
import { KIND_COLOR, KIND_LABEL, kindOf } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useTreeActions, useTreeView } from '@/state/TreeStore';
import type { NodeMetadata, ProblemTree } from '@/types/tree';

interface Hit {
  tree: ProblemTree;
  node: NodeMetadata;
  score: number;
}

const MAX_HITS = 8;

const INDEX = TREES.flatMap((tree) =>
  tree.nodes.map((node) => ({
    tree,
    node,
    label: normalize(node.label),
    full: normalize(`${node.description} ${node.ejeTematico}`),
  })),
);

interface SearchBoxProps {
  query: string;
  onQueryChange: (q: string) => void;
}

/** Buscador predictivo por texto, en todos los árboles (prioriza el actual). */
export function SearchBox({ query, onQueryChange }: SearchBoxProps) {
  const { treeId } = useTreeView();
  const { focusNode } = useTreeActions();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const hits = useMemo<Hit[]>(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    const out: Hit[] = [];
    for (const e of INDEX) {
      let score = 0;
      if (e.label.startsWith(q)) score = 3;
      else if (e.label.includes(q)) score = 2;
      else if (e.full.includes(q)) score = 1;
      if (score === 0) continue;
      out.push({ tree: e.tree, node: e.node, score: score + (e.tree.id === treeId ? 0.5 : 0) });
    }
    return out.sort((a, b) => b.score - a.score || Math.abs(a.node.level) - Math.abs(b.node.level)).slice(0, MAX_HITS);
  }, [query, treeId]);

  const choose = (hit: Hit) => {
    focusNode(hit.tree.id, hit.node.id);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = hits[active];
      if (hit) choose(hit);
    } else if (e.key === 'Escape') {
      setOpen(false);
      e.stopPropagation();
    }
  };

  return (
    <div className="relative w-full min-w-0 sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Buscar causa o efecto…"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => onQueryChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
          aria-label="Limpiar búsqueda"
        >
          <X className="size-3.5" />
        </button>
      )}
      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl sm:w-[26rem]"
        >
          {hits.map((hit, i) => (
            <li key={`${hit.tree.id}-${hit.node.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(hit)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left', i === active && 'bg-slate-100')}
              >
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: KIND_COLOR[kindOf(hit.node.level)] }} />
                <span className="min-w-0">
                  <span className="block text-sm leading-snug text-slate-800">{hit.node.label}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {KIND_LABEL[kindOf(hit.node.level)]} · {hit.tree.titulo}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
