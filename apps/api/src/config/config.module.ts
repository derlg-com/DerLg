import { resolve } from 'node:path';

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './env.validation';

/**
 * Env files are resolved against the package root rather than `process.cwd()`
 * so the app boots identically from `nest start`, `dist/main`, jest and tsx.
 * `src/config` -> `..` -> `..` = apps/api, and the same holds for `dist/config`.
 */
const packageRoot = resolve(__dirname, '..', '..');

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [resolve(packageRoot, '.env.local'), resolve(packageRoot, '.env')],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
