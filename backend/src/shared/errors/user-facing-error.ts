/** A message that is safe to show an operator. It must not contain a password or a connection URL. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
