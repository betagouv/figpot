import { Command } from '@commander-js/extra-typings';

export const program = new Command();

program.name('figpot').description('CLI to perform actions between Figma and Penpot').version('0.0.0');

const document = program.command('document').description('manage documents');

document
  .command('retrieve')
  .description('save Figma documents locally')
  .action(async () => {
    console.log('hello');
  });
