import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return bcrypt.hash(password, 12) as Promise<string>;
}
