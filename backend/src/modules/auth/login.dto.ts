import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateBy } from 'class-validator';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * `developmentAck` is still sent by the current website. It is accepted and
 * ignored so that site can switch to this API before the checkbox is removed.
 */
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ValidateBy({
    name: 'loginEmail',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && value.length <= 320 && EMAIL.test(value),
      defaultMessage: (args) =>
        typeof args?.value === 'string' && args.value.length > 0
          ? 'Enter a valid email address, like name@example.com.'
          : 'Enter your email address.',
    },
  })
  email!: string;

  @ValidateBy({
    name: 'loginPassword',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && value.length >= 8 && value.length <= 200,
      defaultMessage: (args) => {
        if (typeof args?.value !== 'string' || args.value.length === 0)
          return 'Enter your password.';
        if (args.value.length > 200) return 'Use at most 200 characters.';
        return 'Use at least 8 characters.';
      },
    },
  })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: 'developmentAck is not a credential.' })
  developmentAck?: boolean;
}
