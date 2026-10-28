export const SITE_IMAGE_FITS = ['cover', 'contain'] as const;
export type SiteImageFit = (typeof SITE_IMAGE_FITS)[number];

/**
 * Every built-in picture the public site paints from a fixed path.
 * Gallery items, trainee portraits, work photos, and lesson or project
 * covers are content records. They are not slots.
 *
 * After the first migration has been applied, a new slot needs its own
 * migration as well as an entry here. See docs/site-images.md.
 */
export interface SiteImageSlot {
  key: string;
  label: string;
  description: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  fit: SiteImageFit;
  /** Caption under the original community mark. Empty for photographs. */
  tagline: string;
}

function photo(
  key: string,
  label: string,
  description: string,
  file: string,
  alt: string,
  width: number,
  height: number,
  fit: SiteImageFit = 'cover',
): SiteImageSlot {
  return {
    key,
    label,
    description,
    url: `/assets/img/${file}-1600.webp`,
    alt,
    width,
    height,
    fit,
    tagline: '',
  };
}

export const SITE_IMAGE_SLOTS: readonly SiteImageSlot[] = [
  {
    key: 'community-logo',
    label: 'Community logo',
    description:
      'Line mark of a hooded figure at a laptop, drawn in paper white with a dark face void. Header, footer, sign-in, admin sidebar, seals, empty states, and the favicon. On a light header it sits on a forest plate. An uploaded image replaces it. The tagline sits under the larger seals.',
    url: '/assets/logo/community-badge.webp',
    alt: 'Cyber Bootcamp community logo',
    width: 1024,
    height: 1024,
    fit: 'contain',
    tagline: 'STRONGER TOGETHER',
  },
  {
    key: 'foundation-logo',
    label: 'Maxim Nyansa Foundation logo',
    description:
      'Parent-organisation wordmark. Header and footer plate, sign-in form, admin sidebar, about page, and the loader footer. It is not the community logo. A larger PNG or WebP stays sharper. SVG files are not accepted.',
    url: '/assets/logo/maxim-nyansa-foundation-logo.png',
    alt: 'Maxim Nyansa Foundation logo',
    width: 200,
    height: 41,
    fit: 'contain',
    tagline: '',
  },
  photo(
    'home-hero-main',
    'Homepage hero, main photo',
    'The large photo on the homepage hero. The frame stays wide so a group photo is not cropped.',
    'participant-portrait',
    'The Maxim Nyansa Foundation group in white 10-year shirts, posed in front of the anniversary banner',
    1600,
    756,
    'contain',
  ),
  photo(
    'home-hero-side',
    'Homepage hero, side photo',
    'The upper small photo on the homepage hero.',
    'hack-coding-team',
    'A team working together at a laptop',
    1600,
    1066,
  ),
  photo(
    'home-hero-accent',
    'Homepage hero, accent photo',
    'The lower small photo on the homepage hero.',
    'vr-headset-moment',
    'Trying out a VR headset at an event',
    1600,
    1066,
  ),
  photo(
    'home-class-peek-1',
    'Homepage class row, first hover photo',
    'The picture that follows the pointer on the first featured class. Later rows repeat these four pictures.',
    'electronics-lab',
    'Hands-on work at a Foundation build table',
    1600,
    1066,
  ),
  photo(
    'home-class-peek-2',
    'Homepage class row, second hover photo',
    'The pointer picture for the second featured class row.',
    'hack-coding-team',
    'A team working together at a laptop',
    1600,
    1066,
  ),
  photo(
    'home-class-peek-3',
    'Homepage class row, third hover photo',
    'The pointer picture for the third featured class row.',
    'vr-demo-group',
    'A group gathered around a VR demonstration',
    1600,
    1066,
  ),
  photo(
    'home-class-peek-4',
    'Homepage class row, fourth hover photo',
    'The pointer picture for the fourth featured class row.',
    'presenters-yellow-room',
    'Presenters speaking in a yellow room',
    1600,
    1066,
  ),
  photo(
    'bootcamp-banner',
    'Bootcamp overview banner',
    'The wide photo under the facts on the bootcamp overview page.',
    'electronics-lab',
    'Hands-on work at a Foundation build table',
    1600,
    1066,
  ),
  photo(
    'about-banner',
    'About page banner',
    'The wide photo under the introduction on the about page.',
    'anniversary-group-outdoor',
    'An outdoor group photo at a Foundation event',
    1600,
    1067,
  ),
  photo(
    'sign-in-panel',
    'Sign-in panel photo',
    'The photograph behind the words on the sign-in page.',
    'electronics-lab',
    'Hands-on work at a Foundation build table',
    1600,
    1067,
  ),
];

const BY_KEY = new Map(SITE_IMAGE_SLOTS.map((slot) => [slot.key, slot]));

export function siteImageSlot(key: string): SiteImageSlot | undefined {
  return BY_KEY.get(key);
}

export interface SiteImageSeedRow {
  key: string;
  label: string;
  description: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  fit: SiteImageFit;
  defaultUrl: string;
  defaultAlt: string;
  defaultWidth: number;
  defaultHeight: number;
  tagline: string;
  defaultTagline: string;
  storageProvider: 'static';
  storageKey: '';
}

/** The row a new database stores before an administrator changes anything. */
export function siteImageSeedRow(slot: SiteImageSlot): SiteImageSeedRow {
  return {
    key: slot.key,
    label: slot.label,
    description: slot.description,
    url: slot.url,
    alt: slot.alt,
    width: slot.width,
    height: slot.height,
    fit: slot.fit,
    defaultUrl: slot.url,
    defaultAlt: slot.alt,
    defaultWidth: slot.width,
    defaultHeight: slot.height,
    tagline: slot.tagline,
    defaultTagline: slot.tagline,
    storageProvider: 'static',
    storageKey: '',
  };
}
