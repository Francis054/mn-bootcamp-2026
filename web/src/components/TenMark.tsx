import { useReveal } from './Brand';

export function TenMark({ id, caption }: { id: string; caption: string }) {
  const seen = useReveal<SVGSVGElement>();
  return (
    <svg ref={seen.ref} className={`ten${seen.on ? ' is-in' : ''}`} id={id} data-draw viewBox="0 0 420 300" role="img" aria-label="An outlined number 10">
      <path className="t-fill" d="M262 20h36a72 72 0 0172 72v116a72 72 0 01-72 72h-36a72 72 0 01-72-72V92a72 72 0 0172-72z" />
      <path className="t-1" pathLength={1} d="M48 76L118 20v260M70 280h96" />
      <path className="t-2" pathLength={1} d="M262 20h36a72 72 0 0172 72v116a72 72 0 01-72 72h-36a72 72 0 01-72-72V92a72 72 0 0172-72z" />
      <path className="t-3" pathLength={1} d="M240 110l40-40 40 40-40 40zM240 190l40-40 40 40-40 40z" />
      <path className="t-4" pathLength={1} d="M20 140h20M380 150h30" />
      <text x="0" y="298">{caption}</text>
    </svg>
  );
}
