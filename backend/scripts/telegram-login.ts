/**
 * Generates the `TELEGRAM_SESSION` string for the ABA payment listener.
 *
 * Run once per Telegram account:
 *
 * ```bash
 * npm run telegram:login
 * ```
 *
 * ## Why this is needed
 *
 * ABA's credit alerts are posted by ABA's own bot, and the Telegram Bot API
 * forbids a bot from reading another bot's messages. The listener therefore signs
 * in as a real user account over MTProto, which requires an interactive login
 * once; the resulting session string is reused on every boot.
 *
 * ## Before running
 *
 * 1. Create an app at https://my.telegram.org → "API development tools".
 * 2. Put `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in `backend/.env`.
 * 3. Make sure the account is a member of the group where ABA posts alerts.
 *
 * ## Security
 *
 * The printed session string is a **full credential** for that Telegram account —
 * read and write, no second factor. It is written to stdout and never to disk by
 * this script, so it cannot leak into a committed file by accident. Paste it into
 * `.env` (gitignored) and nowhere else.
 */
import { createInterface } from 'readline';
import { config as loadEnv } from 'dotenv';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

loadEnv();

/** Reads one visible line. */
function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Reads one line without echoing it, for the 2FA password.
 *
 * Uses raw mode and reads bytes directly rather than patching
 * `process.stdout.write` around readline. Patching a global stream to suppress
 * readline's echo works but is invisible action-at-a-distance, and it fights the
 * stream's own type signature; raw mode is explicit about exactly which
 * keystrokes are handled.
 */
function askHidden(question: string): Promise<string> {
  process.stdout.write(question);

  const { stdin } = process;
  const wasRaw = stdin.isRaw;
  // Not a TTY (piped input, CI): fall back to a normal prompt rather than
  // hanging waiting for keystrokes that will never be interactive.
  if (!stdin.isTTY) return ask('');

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    let value = '';

    const finish = (): void => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      process.stdout.write('\n');
      resolve(value.trim());
    };

    const onData = (chunk: string): void => {
      for (const char of chunk) {
        switch (char) {
          case '\r':
          case '\n':
            finish();
            return;
          case '\u0003': // Ctrl-C
            stdin.setRawMode(wasRaw ?? false);
            process.stdout.write('\n');
            process.exit(130);
            return;
          case '\u007f': // Backspace
          case '\b':
            value = value.slice(0, -1);
            break;
          default:
            // Ignore other control characters (arrows, tab, escape sequences).
            if (char >= ' ') value += char;
        }
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Renders an account identifier for the console.
 *
 * GramJS returns ids as `BigInteger` instances, whose `toString()` is meaningful.
 * A blanket `String(value)` would print `[object Object]` for anything else, so
 * the shape is narrowed first.
 */
function describeAccount(
  me: { username?: string; id?: unknown } | undefined,
): string {
  if (me?.username) return me.username;
  const id: unknown = me?.id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number' || typeof id === 'bigint') return id.toString();
  if (id && typeof (id as { toString?: unknown }).toString === 'function') {
    return (id as { toString: () => string }).toString();
  }
  return 'unknown';
}

async function main(): Promise<void> {
  const apiId = Number(process.env.TELEGRAM_API_ID ?? 0);
  const apiHash = process.env.TELEGRAM_API_HASH ?? '';

  if (!apiId || !apiHash) {
    console.error(
      '\nTELEGRAM_API_ID and TELEGRAM_API_HASH must be set in backend/.env first.\n' +
        'Create an app at https://my.telegram.org → "API development tools".\n',
    );
    process.exitCode = 1;
    return;
  }

  // Empty session: this run is what populates it.
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 3,
  });

  console.log('\nSigning in to Telegram. Answer the prompts below.\n');

  await client.start({
    phoneNumber: () => ask('Phone number (international, e.g. +85512345678): '),
    password: () => askHidden('2FA password (blank if you have none): '),
    phoneCode: () => ask('Login code Telegram just sent you: '),
    onError: (error: Error) => {
      console.error(`Login error: ${error.message}`);
    },
  });

  const me = (await client.getMe()) as
    | { username?: string; id?: unknown }
    | undefined;
  const session = String(client.session.save());

  console.log('\n=== LOGIN SUCCESSFUL ===');
  console.log(`Signed in as: ${describeAccount(me)}`);
  console.log('\nAdd this line to backend/.env and keep it secret:\n');
  console.log(`TELEGRAM_SESSION=${session}\n`);
  console.log(
    'Reminders:\n' +
      '  • This string grants full access to the account. Never commit it.\n' +
      '  • The account must be a member of the ABA alert group.\n' +
      '  • Set ABA_ALERT_SENDER_IDS so only ABA can settle a payment.\n',
  );

  await client.disconnect();
}

void main().catch((error: Error) => {
  console.error(`\nFailed: ${error.message}\n`);
  process.exitCode = 1;
});
