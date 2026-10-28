import type { MigrationInterface, QueryRunner } from 'typeorm';

const PREVIOUS_COMMUNITY =
  'The approved community badge (black hat and ethical hat). Header, footer, sign-in panel, admin sidebar, empty states, the loading screen, and the favicon. While this slot is the original artwork, the foundation logo and the badge tagline are drawn on top. A replacement image is shown on its own.';

const SVG_COMMUNITY =
  'White-hat community mark: a person dressed in white, wearing a white hat. Header, footer, sign-in panel, admin sidebar, seals, empty states, and the favicon. The original is a crisp SVG. An uploaded image replaces it. The tagline sits under the larger seals.';

const PHOTO_COMMUNITY =
  'White-hat community mark: a photograph of a person in a white cap at a laptop, graded in forest and lime inside a round badge. Header, footer, sign-in, admin sidebar, seals, empty states, and the favicon. An uploaded image replaces it. The tagline sits under the larger seals.';

const LIME_COMMUNITY =
  'Line mark of a hooded figure at a laptop, in the site forest, paper, and lime colours. Header, footer, sign-in, admin sidebar, seals, empty states, and the favicon. An uploaded image replaces it. The tagline sits under the larger seals.';

const NEXT_COMMUNITY =
  'Line mark of a hooded figure at a laptop, drawn in paper white with a dark face void. Header, footer, sign-in, admin sidebar, seals, empty states, and the favicon. On a light header it sits on a forest plate. An uploaded image replaces it. The tagline sits under the larger seals.';

const PREVIOUS_FOUNDATION =
  'The parent-organisation wordmark. It is drawn inside the community badge, in the header and footer plate, on the sign-in form, in the admin sidebar, on the about page, and in the loader footer. It is not the community logo. A larger PNG or WebP stays sharper. SVG files are not accepted.';

const NEXT_FOUNDATION =
  'Parent-organisation wordmark. Header and footer plate, sign-in form, admin sidebar, about page, and the loader footer. It is not the community logo. A larger PNG or WebP stays sharper. SVG files are not accepted.';

/**
 * The community mark is now the hood line drawing. Copy that still describes
 * the retired two-hat badge, the unreleased drawn SVG, or the stock photograph
 * is updated.
 * A row an administrator has already rewritten is left alone. Fresh databases
 * insert the new copy from the catalogue, so this update matches nothing there.
 */
export class CommunityLogo1794096000000 implements MigrationInterface {
  name = 'CommunityLogo1794096000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "site_images" SET "description" = $1 WHERE "key" = 'community-logo' AND "description" = $2`,
      [NEXT_COMMUNITY, PREVIOUS_COMMUNITY],
    );
    await queryRunner.query(
      `UPDATE "site_images" SET "description" = $1 WHERE "key" = 'community-logo' AND "description" = $2`,
      [NEXT_COMMUNITY, SVG_COMMUNITY],
    );
    await queryRunner.query(
      `UPDATE "site_images" SET "description" = $1 WHERE "key" = 'community-logo' AND "description" = $2`,
      [NEXT_COMMUNITY, PHOTO_COMMUNITY],
    );
    await queryRunner.query(
      `UPDATE "site_images" SET "description" = $1 WHERE "key" = 'community-logo' AND "description" = $2`,
      [NEXT_COMMUNITY, LIME_COMMUNITY],
    );
    await queryRunner.query(
      `UPDATE "site_images" SET "description" = $1 WHERE "key" = 'foundation-logo' AND "description" = $2`,
      [NEXT_FOUNDATION, PREVIOUS_FOUNDATION],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "site_images" SET "description" = $1 WHERE "key" = 'community-logo' AND "description" = $2`,
      [PREVIOUS_COMMUNITY, NEXT_COMMUNITY],
    );
    await queryRunner.query(
      `UPDATE "site_images" SET "description" = $1 WHERE "key" = 'foundation-logo' AND "description" = $2`,
      [PREVIOUS_FOUNDATION, NEXT_FOUNDATION],
    );
  }
}
