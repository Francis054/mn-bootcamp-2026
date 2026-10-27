import { ValidateBy } from 'class-validator';
import {
  siteImageAltMessage,
  siteImageKeyMessage,
  siteImageTaglineMessage,
} from './site-image.rules.js';

function rule(name: string, problem: (value: unknown) => string | undefined, fallback: string) {
  return ValidateBy({
    name,
    validator: {
      validate: (value: unknown) => problem(value) === undefined,
      defaultMessage: (args) => problem(args?.value) ?? fallback,
    },
  });
}

/** Body for `POST /admin/site-images`. The key must already be in the catalogue. */
export class SiteImageCreateDto {
  @rule('key', siteImageKeyMessage, 'Choose a known image slot.')
  key!: string;
}

/** Body for `PATCH /admin/site-images/:key`. */
export class SiteImageAltDto {
  @rule('alt', siteImageAltMessage, 'Use plain text.')
  alt!: string;

  @rule('tagline', siteImageTaglineMessage, 'Use plain text.')
  tagline?: string;
}
