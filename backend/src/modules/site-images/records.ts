import type { SiteImageFit } from './catalogue.js';

/** What the public site needs in order to paint a slot. */
export interface PublicSiteImage {
  key: string;
  label: string;
  description: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  fit: SiteImageFit;
  updatedAt: string;
}

/** The admin copy. Storage keys stay on the server. */
export interface SiteImageRecord extends PublicSiteImage {
  defaultUrl: string;
  defaultAlt: string;
  usingDefault: boolean;
  updatedBy: string | null;
}
