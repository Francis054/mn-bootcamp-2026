import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useLightbox } from '@/components/feedback';
import { normalizeWorkPhotos } from '@/domain/publicContract';
import type { PublicWorkPhoto } from '@/domain/types';
import { workPhotoAddress } from '@/domain/workPhoto';

/** Published photos for one trainee, one project, or both. Hidden when there are none. */
export function PublicWorkPhotos({
  traineeId,
  projectId,
  heading,
}: {
  traineeId?: string;
  projectId?: string;
  heading: string;
}) {
  const [photos, setPhotos] = useState<PublicWorkPhoto[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const open = useLightbox();
  useEffect(() => {
    let cancel = false;
    const query: Record<string, string> = {};
    if (traineeId) query.traineeId = traineeId;
    if (projectId) query.projectId = projectId;
    api<unknown>({ method: 'GET', path: '/public/work-photos', query })
      .then((rows) => {
        if (!cancel) setPhotos(normalizeWorkPhotos(rows));
      })
      .catch(() => {
        if (!cancel) setPhotos([]);
      });
    return () => {
      cancel = true;
    };
  }, [traineeId, projectId]);

  const visible = (photos ?? []).flatMap((photo) => {
    if (hidden.includes(photo.id)) return [];
    const src = workPhotoAddress(photo, 'public');
    return src ? [{ photo, src }] : [];
  });
  if (!visible.length) return null;
  const items = visible.map(({ photo, src }) => ({
    src,
    alt: photo.alt,
    caption: photo.caption,
    category: 'Work',
    width: photo.width,
    height: photo.height,
  }));

  return (
    <section className="section" aria-label={heading}>
      <div className="container">
        <h2 className="h3">{heading}</h2>
        <p className="muted">Photos of trainees working. People are described, not named, in the picture text.</p>
        <div className="masonry" style={{ marginTop: 24 }}>
          {visible.map(({ photo, src }, index) => (
            <button className="m-item" type="button" key={photo.id} aria-label={`Open photo: ${photo.caption || photo.alt}`} onClick={() => open(items, index)}>
              <img src={src} alt={photo.alt} width={photo.width} height={photo.height} onError={() => setHidden((current) => current.includes(photo.id) ? current : [...current, photo.id])} />
              <figcaption>{photo.caption || photo.alt}</figcaption>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
