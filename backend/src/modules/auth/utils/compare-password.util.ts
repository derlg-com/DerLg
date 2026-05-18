import bcrypt from 'bcrypt';

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return bcrypt.compare(password, hash) as Promise<boolean>;
}
