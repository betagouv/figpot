import { Command, Option } from '@commander-js/extra-typings';

import {
  CompareOptions,
  DocumentOptionsType,
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
import { processDocumentsParametersFromInput, retrieveDocumentsFromInput } from '@figpot/src/features/figma';
import { ensureAccessTokens } from '@figpot/src/utils/environment';

export const program = new Command();

program.name('figpot').description('CLI to perform actions between Figma and Penpot').version('0.0.0');

const document = program.command('document').description('manage documents');
const debugDocument = document.command('debug').description('manage documents step by step to debug');

const documentsOption = new Option('-d, --document [documents...]', 'figma document id as source and penpot one as target (`-d figmaId[:penpotId]`)');

document
  .command('synchronize')
  .description('synchronize Figma documents to Penpot ones')
  .addOption(documentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    let documents: DocumentOptionsType[];
    if (!options.document || options.document === true) {
      documents = (await retrieveDocumentsFromInput()).map((figmaDocument) => {
        return {
          figmaDocument: figmaDocument,
        };
      });
    } else {
      documents = processDocumentsParametersFromInput(options.document);
    }

    await synchronize(
      SynchronizeOptions.parse({
        documents: documents,
      })
    );
  });

debugDocument
  .command('retrieve')
  .description('save Figma documents locally')
  .addOption(documentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await retrieve(
      RetrieveOptions.parse({
        documents: documents,
      })
    );
  });

debugDocument
  .command('transform')
  .description('transform Figma documents format to Penpot one')
  .addOption(documentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await transform(
      TransformOptions.parse({
        documents: documents,
      })
    );
  });

debugDocument
  .command('compare')
  .description('compare Figma and Penpot documents to know what to operate')
  .addOption(documentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await compare(
      CompareOptions.parse({
        documents: documents,
      })
    );
  });

debugDocument
  .command('set')
  .description('execute operations')
  .addOption(documentsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await set(
      SetOptions.parse({
        documents: documents,
      })
    );
  });
