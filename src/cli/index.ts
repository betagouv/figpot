#!/usr/bin/env node
import { program } from '@figpot/src/cli/program';
import { UserCancellationExit, gracefulExit } from '@figpot/src/utils/system';

program.parseAsync().catch((error) => {
  // User explicitly chose to abort: caller already printed the relevant message, exit silently
  if (error instanceof UserCancellationExit) {
    process.exit(0);
  }

  gracefulExit(error);
});
