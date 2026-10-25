import { useEffect, useState } from 'react';
import { COMMUNITY_BADGE_BARE } from '@/domain/siteImages';
import { useSiteImage } from '@/hooks/useSiteImages';

/**
 * Community badge.
 * The original artwork keeps a live foundation plate and the tagline banner,
 * at the same geometry as the approved 1024px composition. A replacement
 * image is painted on its own.
 */
export function CommunityBadge({ variant = 'full', className = '', label = '', priority = false }: { variant?: 'full' | 'mark'; className?: string; label?: string; priority?: boolean }) {
  const badge = useSiteImage('community-logo');
  const plate = useSiteImage('foundation-logo');
  const [broken, setBroken] = useState(false);
  const [plateSrc, setPlateSrc] = useState(plate.src);

  useEffect(() => {
    setBroken(false);
  }, [badge.src]);

  useEffect(() => {
    setPlateSrc(plate.src);
  }, [plate.src]);

  const live = badge.liveBadge || broken;
  const named = label.trim().length > 0;
  const tagline = badge.tagline.trim();
  const classNames = `community-badge community-badge--${variant}${live ? '' : ' community-badge--custom'} ${className}`.trim();

  if (!live) {
    return <img className={classNames} src={badge.src} alt={named ? label : ''} width={badge.width} height={badge.height} decoding="async" fetchPriority={priority ? 'high' : 'auto'} onError={() => setBroken(true)} />;
  }

  return (
    <span className={classNames} role={named ? 'img' : undefined} aria-label={named ? label : undefined} aria-hidden={named ? undefined : true}>
      <img className="community-badge__art" src={COMMUNITY_BADGE_BARE} alt="" width={1024} height={1024} decoding="async" fetchPriority={priority ? 'high' : 'auto'} />
      {variant === 'full' ? (
        <>
          <svg className="community-badge__overlay" viewBox="0 0 1024 1024" aria-hidden="true">
            <rect x="365" y="730" width="294" height="81" rx="40.5" fill="#F6F7F2" stroke="#88CC00" strokeWidth="3" />
            {tagline ? (
              <>
                <rect x="362" y="905" width="300" height="44" rx="22" fill="#0A1F16" stroke="#88CC00" strokeWidth="3" />
                <text x="512" y="927" textAnchor="middle" dominantBaseline="middle" fill="#88CC00" fontFamily="Poppins, 'Space Grotesk', sans-serif" fontWeight="900" fontSize={tagline.length > 22 ? 14 : 17} letterSpacing={tagline.length > 22 ? 1 : 2}>
                  {tagline.toUpperCase()}
                </text>
              </>
            ) : null}
          </svg>
          <img
            className="community-badge__plate"
            src={plateSrc}
            alt=""
            width={plate.width}
            height={plate.height}
            decoding="async"
            onError={() => {
              if (plateSrc !== plate.fallbackSrc) setPlateSrc(plate.fallbackSrc);
            }}
          />
        </>
      ) : null}
    </span>
  );
}
