/**
 * Thrown by CLI commands to signal an error exit.
 * Caught by main() which writes message to stderr and calls process.exit(exitCode).
 */
export class CliError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1,
  ) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * Thrown by CLI commands to signal intentional non-error exit with a specific code.
 * For example, `status` exits with code 3 for "needs-work" — not an error, just a signal.
 * Caught by main() which calls process.exit(exitCode) without printing an error.
 */
export class CliExitCode {
  constructor(public exitCode: number) {}
}
