import { IsString, MinLength } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/shared/errors/api-error.js';
import { validateDto } from '../../src/shared/validation/validate-dto.js';

class TitleDto {
  @IsString({ message: 'Give the class a title.' })
  @MinLength(1, { message: 'Give the class a title.' })
  title!: string;
}

describe('validateDto', () => {
  it('returns the instance when the payload matches the class', async () => {
    const dto = await validateDto(TitleDto, { title: 'Networks' });
    expect(dto).toBeInstanceOf(TitleDto);
    expect(dto.title).toBe('Networks');
  });

  it('returns field errors and rejects properties the class does not declare', async () => {
    expect.assertions(3);
    try {
      await validateDto(TitleDto, { title: '', extra: 'nope' });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(422);
        expect(error.fieldErrors).toMatchObject({
          title: 'Give the class a title.',
        });
      }
    }
  });
});
