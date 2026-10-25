import { useEffect, useState, type CSSProperties } from 'react';
import { useSiteImage } from '@/hooks/useSiteImages';
import type { SiteImageKey } from '@/domain/siteImages';

/**
 * A built-in picture. The bundled file shows immediately, and again if the
 * stored address fails, so a missing upload never leaves a broken image.
 * Width and height stay on the element so the frame does not jump.
 */
export function SiteImage({
  slot,
  sizes,
  priority = false,
  className,
  style,
  alt,
}: {
  slot: SiteImageKey;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  const image = useSiteImage(slot);
  const [src, setSrc] = useState(image.src);
  const [srcSet, setSrcSet] = useState(image.srcSet);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setSrc(image.src);
    setSrcSet(image.srcSet);
    setHidden(false);
  }, [image.src, image.srcSet]);

  const shownAlt = alt ?? image.alt;
  const frame: CSSProperties = {
    ...(image.fit === 'contain' ? { objectFit: 'contain', objectPosition: 'center' } : {}),
    ...style,
  };
  if (hidden || !src) {
    return <span className={className} style={{ display: 'block', aspectRatio: `${image.width} / ${image.height}`, ...frame }} aria-hidden="true" />;
  }
  return (
    <img
      className={className}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      width={image.width}
      height={image.height}
      alt={shownAlt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      data-fit={image.fit === 'contain' ? 'contain' : undefined}
      style={Object.keys(frame).length ? frame : undefined}
      onError={() => {
        if (src !== image.fallbackSrc) {
          setSrc(image.fallbackSrc);
          setSrcSet(image.fallbackSrcSet);
          return;
        }
        setHidden(true);
      }}
    />
  );
}
