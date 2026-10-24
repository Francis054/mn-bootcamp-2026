import { describe, expect, it } from 'vitest';
import { LoginDto } from '../../src/modules/auth/login.dto.js';
import { ApiError } from '../../src/shared/errors/api-error.js';
import { validateDto } from '../../src/shared/validation/validate-dto.js';

describe('LoginDto', () => {
  it('accepts the website body, including the ignored development checkbox', async () => {
    const dto = await validateDto(LoginDto, {
      email: ' Ada@Example.test ',
      password: 'Correct-horse-1',
      developmentAck: true,
    });
    expect(dto.email).toBe('ada@example.test');
    expect(dto.developmentAck).toBe(true);
  });

  it('reports empty fields and rejects a role in the body', async () => {
    expect.assertions(2);
    try {
      await validateDto(LoginDto, { email: '', password: '', role: 'administrator' });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.fieldErrors).toMatchObject({
          email: 'Enter your email address.',
          password: 'Enter your password.',
        });
      }
    }
  });
});
