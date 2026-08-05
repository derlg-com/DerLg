import { SetMetadata } from '@nestjs/common';

import { RAW_RESPONSE_KEY } from '../interceptors/response-envelope.interceptor';

/**
 * Opts a handler out of the response envelope. Required for SSE streams,
 * Stripe webhooks and binary downloads, whose bodies must stay untouched.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
