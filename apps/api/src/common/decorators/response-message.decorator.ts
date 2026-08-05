import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'derlg:response-message';

/** Overrides the default `message` in the success envelope for a handler. */
export const ResponseMessage = (message: string) => SetMetadata(RESPONSE_MESSAGE_KEY, message);
