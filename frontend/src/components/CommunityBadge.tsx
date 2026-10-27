import { useEffect, useState } from 'react';
import { useSiteImage } from '@/hooks/useSiteImages';

/** Crisp community mark. The original artwork is the white-hat SVG. A replacement image is shown on its own. */
export function CommunityBadge({ variant = 'full', className = '', label = '', priority = false }: { variant?: 'full' | 'mark'; className?: string; label?: string; priority?: boolean }) {
  const badge = useSiteImage('community-logo');
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [badge.src]);

  const live = badge.liveBadge || broken;
  const named = label.trim().length > 0;
  const tagline = badge.tagline.trim();
  const classNames = `community-badge community-badge--${variant}${live ? '' : ' community-badge--custom'} ${className}`.trim();

  if (!live) {
    return <img className={classNames} src={badge.src} alt={named ? label : ''} width={badge.width} height={badge.height} decoding="async" fetchPriority={priority ? 'high' : 'auto'} onError={() => setBroken(true)} />;
  }

  return (
    <span className={classNames} role={named ? 'img' : undefined} aria-label={named ? label : undefined} aria-hidden={named ? undefined : true}>
      <img className="community-badge__art" src="/assets/logo/white-hat.svg" alt="" width={128} height={128} decoding="async" fetchPriority={priority ? 'high' : 'auto'} />
      {variant === 'full' && tagline ? <span className="community-badge__tagline">{tagline}</span> : null}
    </span>
  );
}
