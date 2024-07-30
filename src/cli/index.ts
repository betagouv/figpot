#!/usr/bin/env node
import { program } from '@figpot/src/cli/program';
import { gracefulExit } from '@figpot/src/utils/system';

program.parseAsync().catch((error) => {
  gracefulExit(error);
});
