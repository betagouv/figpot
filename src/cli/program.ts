import { Command, Option } from '@commander-js/extra-typings';

import {
  CompareOptions,
  RetrieveOptions,
  SetOptions,
  SynchronizeOptions,
  TransformOptions,
  compare,
  retrieve,
  set,
  synchronize,
  transform,
} from '@figpot/src/features/document';
import { retrieveDocumentsFromInput } from '@figpot/src/features/figma';
import { ensureAccessTokens } from '@figpot/src/utils/environment';

export const program = new Command();

program.name('figpot').description('CLI to perform actions between Figma and Penpot').version('0.0.0');

const document = program.command('document').description('manage documents');
const debugDocument = document.command('debug').description('manage documents step by step to debug');

const figmaDocumentsOption = new Option('-fd, --figma-document [figmaDocuments...]', 'figma document id as source');
const penpotDocumentsOption = new Option('-pd, --penpot-document [penpotDocuments...]', 'penpot document id as target');

document
  .command('synchronize')
  .description('synchronize Figma documents to Penpot ones')
  .addOption(figmaDocumentsOption)
  .addOption(penpotDocumentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    if (!options.figmaDocument || options.figmaDocument === true) {
      options.figmaDocument = await retrieveDocumentsFromInput();
    }

    await synchronize(
      SynchronizeOptions.parse({
        figmaDocuments: options.figmaDocument,
        penpotDocuments: options.penpotDocument,
      })
    );
  });

debugDocument
  .command('retrieve')
  .description('save Figma documents locally')
  .addOption(figmaDocumentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    await retrieve(
      RetrieveOptions.parse({
        figmaDocuments: options.figmaDocument,
      })
    );
  });

debugDocument
  .command('transform')
  .description('transform Figma documents format to Penpot one')
  .addOption(figmaDocumentsOption)
  .addOption(penpotDocumentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    await transform(
      TransformOptions.parse({
        figmaDocuments: options.figmaDocument,
        penpotDocuments: options.penpotDocument,
      })
    );
  });

debugDocument
  .command('compare')
  .description('compare Figma and Penpot documents to know what to operate')
  .addOption(figmaDocumentsOption)
  .addOption(penpotDocumentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    await compare(
      CompareOptions.parse({
        figmaDocuments: options.figmaDocument,
        penpotDocuments: options.penpotDocument,
      })
    );
  });

debugDocument
  .command('set')
  .description('execute operations')
  .addOption(figmaDocumentsOption)
  .addOption(penpotDocumentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    await set(
      SetOptions.parse({
        figmaDocuments: options.figmaDocument,
        penpotDocuments: options.penpotDocument,
      })
    );
  });
