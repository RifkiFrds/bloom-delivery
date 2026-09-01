/**
 * Recipient-name sanitization — Doc 02 §6.3.
 *
 * THE FIVE LINES THAT REPLACED ZOD.
 *
 * Zod was ~14 KB gzip to validate one optional query-string name against a
 * regex. PRD v2 removed it from the stack for exactly this reason.
 *
 *   - Unicode-aware (\p{L}\p{M}) so non-Latin names work
 *   - Capped at 24 characters to prevent layout destruction
 *   - Rendered exclusively as a TEXT NODE. Never innerHTML, never
 *     dangerouslySetInnerHTML.
 */

import { DEFAULT_RECIPIENT } from '@/machine';

const VALID_NAME = /^[\p{L}\p{M}\s'’-]{1,24}$/u;

export function sanitizeRecipientName(input: string | null | undefined): string {
  if (input === null || input === undefined) return DEFAULT_RECIPIENT;
  const trimmed = input.trim();
  return VALID_NAME.test(trimmed) ? trimmed : DEFAULT_RECIPIENT;
}

export function readRecipientFromLocation(search: string): string {
  try {
    return sanitizeRecipientName(new URLSearchParams(search).get('to'));
  } catch {
    return DEFAULT_RECIPIENT;
  }
}
