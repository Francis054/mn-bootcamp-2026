import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs } from '@/components/controls';
import { EmptyState } from '@/components/feedback';
import { formatDate } from '@/domain/format';
import { FILTERS, KIND_LABEL, filterJourney, type JourneyFilter, type JourneyItem, type JourneyState } from '@/domain/journey';

export function JourneyTimeline({
  items,
  layout = 'page',
  onEdit,
  onDelete,
}: {
  items: JourneyItem[];
  layout?: 'page' | 'section';
  onEdit?: (item: JourneyItem) => void;
  onDelete?: (item: JourneyItem) => void;
}) {
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const rows = filterJourney(items, filter);
  const blocks = items.filter((item) => item.kind === 'block');
  const list = (
    rows.length ? (
      <ol className="tl">
        <li className="tl__progress" aria-hidden="true" />
        {rows.map((item) => (
          item.kind === 'block' ? (
            <li className="tl__phase" id={`ph-${item.blockId ?? item.id}`} key={item.id}>
              {item.title}
            </li>
          ) : (
            <li className={itemClass(item)} key={item.id}>
              <span className="tl__dot" />
              <JourneyCard item={item} onEdit={onEdit} onDelete={onDelete} />
            </li>
          )
        ))}
      </ol>
    ) : (
      <EmptyState icon="calendar" title="Nothing in this view" text="Try another filter. Public milestones, approved work, and the timetable show up here." />
    )
  );
  if (layout === 'section') {
    return (
      <div className="journey-section">
        <div className="journey-filters">
          <Tabs label="Filter journey" value={filter} onChange={(id) => setFilter(asFilter(id))} tabs={FILTERS.map((item) => ({ id: item.id, label: item.label }))} />
        </div>
        <div style={{ marginTop: 24 }}>{list}</div>
      </div>
    );
  }
  return (
    <div className="jt">
      <aside className="jt__side">
        <div className="sticky">
          <div className="journey-filters">
            <Tabs label="Filter journey" value={filter} onChange={(id) => setFilter(asFilter(id))} tabs={FILTERS.map((item) => ({ id: item.id, label: item.label }))} />
          </div>
          {blocks.length ? (
            <nav className="toc" style={{ marginTop: 32 }} aria-label="Blocks">
              {blocks.map((item) => <a key={item.id} href={`#ph-${item.blockId ?? item.id}`}>{item.title}</a>)}
            </nav>
          ) : null}
          <div className="callout" style={{ marginTop: 32 }}>
            <h3>Legend</h3>
            <p style={{ display: 'grid', gap: 10, fontSize: 14 }}>
              <span className="st st--done">Completed</span>
              <span className="st st--now">This week</span>
              <span className="st st--upcoming">Upcoming</span>
              <span>Gold cards are milestones</span>
            </p>
          </div>
        </div>
      </aside>
      <div className="jt__main">{list}</div>
    </div>
  );
}

function JourneyCard({
  item,
  onEdit,
  onDelete,
}: {
  item: JourneyItem;
  onEdit?: (item: JourneyItem) => void;
  onDelete?: (item: JourneyItem) => void;
}) {
  const body = (
    <>
      <div className="flex wrap" style={{ gap: 10, justifyContent: 'space-between' }}>
        <span className="tl__date">{dateLabel(item)}</span>
        <span className="tl__kind">{KIND_LABEL[item.kind]}{item.visibility === 'private' ? ' · Private' : ''}</span>
      </div>
      {stateText(item.state) ? <span className={`st st--${item.state === 'recorded' ? 'done' : item.state}`}>{stateText(item.state)}</span> : null}
      <h3>{item.title}</h3>
      {item.summary ? <p className={item.kind === 'milestone' ? undefined : 'muted'} style={{ fontSize: 15 }}>{item.summary}</p> : null}
      {item.deliverables.length ? (
        <ul className="objectives">
          {item.deliverables.map((line) => <li key={line}><span>{line}</span></li>)}
        </ul>
      ) : null}
      {item.editable ? (
        <div className="portal-actions">
          <button className="btn btn--sm" type="button" onClick={() => onEdit?.(item)}>Edit</button>
          <button className="btn btn--sm" type="button" onClick={() => onDelete?.(item)}>Delete</button>
        </div>
      ) : null}
    </>
  );
  if (item.href) return <Link className="tl__card" to={item.href}>{body}</Link>;
  return <div className="tl__card">{body}</div>;
}

function itemClass(item: JourneyItem): string {
  const milestone = item.kind === 'milestone' || item.kind === 'account' ? ' tl__item--milestone' : '';
  const now = item.state === 'now' ? ' is-now' : '';
  const reached = item.state === 'done' || item.state === 'recorded' ? ' is-reached' : '';
  const hidden = item.visibility === 'private' ? ' tl__item--private' : '';
  return `tl__item${milestone}${now}${reached}${hidden}`;
}

function dateLabel(item: JourneyItem): string {
  if (!item.occurredOn) return KIND_LABEL[item.kind];
  if (item.kind === 'week') return `Week · w/c ${formatDate(item.occurredOn)}`;
  return formatDate(item.occurredOn);
}

function stateText(state: JourneyState): string {
  if (state === 'done') return 'Completed';
  if (state === 'now') return 'This week';
  if (state === 'upcoming') return 'Upcoming';
  return '';
}

function asFilter(value: string): JourneyFilter {
  return FILTERS.some((item) => item.id === value) ? value as JourneyFilter : 'all';
}
