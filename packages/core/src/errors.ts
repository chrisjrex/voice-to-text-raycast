/**
 * Exit codes for CLI
 */

export const ExitCodes = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  MISSING_DEPENDENCY: 2,
  NOT_DOWNLOADED: 3,
  UNKNOWN_VOICE: 4,
  UNKNOWN_MODEL: 5,
  CONFIG_ERROR: 6,
} as const;

export type ExitCode = typeof ExitCodes[keyof typeof ExitCodes];
