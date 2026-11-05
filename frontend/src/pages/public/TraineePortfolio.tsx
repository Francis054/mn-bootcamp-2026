import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { KIND_LABEL, readPublicPortfolio, safeHttps, type PublicPortfolioItem } from '@/domain/portfolio';
import { MediaGallery } from '@/pages/portal/PortfolioEditor';

/** Approved portfolio items on a public trainee profile. No staff links. */
export function TraineePortfolio({ traineeId }: { traineeId: string }) {
  const [items, setItems] = useState<PublicPortfolioItem[] | null>(null);
  useEffect(() => {
    let cancel = false;
    api<unknown>({ method: 'GET', path: `/public/trainees/${traineeId}/portfolio` })
      .then((rows) => {
        if (!cancel) setItems(readPublicPortfolio(rows));
      })
      .catch(() => {
        if (!cancel) setItems([]);
      });
    return () => {
      cancel = true;
    };
  }, [traineeId]);
  if (!items?.length) return null;
  return (
    <div className="portfolio-public">
      <h3>Portfolio</h3>
      {items.map((item) => (
        <article className="portfolio-public__item" key={item.id}>
          <p className="tag">{KIND_LABEL[item.kind]}</p>
          <h4>{item.title}</h4>
          {item.summary ? <p>{item.summary}</p> : null}
          {item.skills.length ? <p>{item.skills.join(' · ')}</p> : null}
          {item.startedOn || item.completedOn ? <p className="muted">{[item.startedOn, item.completedOn].filter(Boolean).join(' – ')}</p> : null}
          <p className="portfolio-links">
            {safeHttps(item.repositoryUrl) ? <a href={safeHttps(item.repositoryUrl) ?? undefined} rel="noopener noreferrer nofollow ugc" target="_blank">Repository</a> : null}
            {safeHttps(item.demoUrl) ? <a href={safeHttps(item.demoUrl) ?? undefined} rel="noopener noreferrer nofollow ugc" target="_blank">Demo</a> : null}
          </p>
          <MediaGallery media={item.media} title={item.title} />
        </article>
      ))}
    </div>
  );
}
