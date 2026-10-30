import { useEffect, useState } from 'react';
import { useSiteImage } from '@/hooks/useSiteImages';

/** The cohort fedora. A replacement upload is shown on its own, without the tagline. */
export function CommunityBadge({ variant = 'full', className = '', label = '', priority = false }: { variant?: 'full' | 'mark'; className?: string; label?: string; priority?: boolean }) {
  const badge = useSiteImage('community-logo');
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [badge.src]);

  const live = badge.liveBadge || broken;
  const named = label.trim().length > 0;
  const tagline = badge.tagline.trim();
  const src = broken ? badge.fallbackSrc : badge.src;
  const classNames = `community-badge community-badge--${variant}${live ? '' : ' community-badge--custom'} ${className}`.trim();

  if (!live) {
    return <img className={classNames} src={src} alt={named ? label : ''} width={badge.width} height={badge.height} decoding="async" fetchPriority={priority ? 'high' : 'auto'} onError={() => setBroken(true)} />;
  }

  return (
    <span className={classNames} role={named ? 'img' : undefined} aria-label={named ? label : undefined} aria-hidden={named ? undefined : true}>
      <img className="community-badge__art" src={src} alt="" width={badge.width} height={badge.height} decoding="async" fetchPriority={priority ? 'high' : 'auto'} />
      {variant === 'full' && tagline ? <span className="community-badge__tagline">{tagline}</span> : null}
    </span>
  );
}
