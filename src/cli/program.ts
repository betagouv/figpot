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

const patternInfo = '(use single quotes around the regexp to prevent your terminal to replace special characters)';
const excludePagePatternsOption = new Option(
  '-expp, --exclude-page-pattern [excludePagePatterns...]',
  `regexp applied on each page name ${patternInfo}`
);
const excludeNodePatternsOption = new Option(
  '-exnp, --exclude-node-pattern [excludeNodePatterns...]',
  `regexp applied on each node name ${patternInfo}`
);
const excludeComponentPatternsOption = new Option(
  '-excp, --exclude-component-pattern [excludeComponentPatterns...]',
  `regexp applied on each component name ${patternInfo}`
);
const excludeTypographyPatternsOption = new Option(
  '-extp, --exclude-typography-pattern [excludeTypographyPatterns...]',
  `regexp applied on each typography name ${patternInfo}`
);
const excludeColorPatternsOption = new Option(
  '-excp, --exclude-color-pattern [excludeColorPatterns...]',
  `regexp applied on each color name ${patternInfo}`
);

document
  .command('synchronize')
  .description('synchronize Figma documents to Penpot ones')
  .addOption(documentsOption)
  .addOption(excludePagePatternsOption)
  .addOption(excludeNodePatternsOption)
  .addOption(excludeComponentPatternsOption)
  .addOption(excludeTypographyPatternsOption)
  .addOption(excludeColorPatternsOption)
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
        excludePatterns: {
          pageNamePatterns: Array.isArray(options.excludePagePattern) ? options.excludePagePattern : undefined,
          nodeNamePatterns: Array.isArray(options.excludeNodePattern) ? options.excludeNodePattern : undefined,
          componentNamePatterns: Array.isArray(options.excludeComponentPattern) ? options.excludeComponentPattern : undefined,
          typographyNamePatterns: Array.isArray(options.excludeTypographyPattern) ? options.excludeTypographyPattern : undefined,
          colorNamePatterns: Array.isArray(options.excludeColorPattern) ? options.excludeColorPattern : undefined,
        },
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
  .addOption(excludePagePatternsOption)
  .addOption(excludeNodePatternsOption)
  .addOption(excludeComponentPatternsOption)
  .addOption(excludeTypographyPatternsOption)
  .addOption(excludeColorPatternsOption)
  .action(async (options) => {
    await ensureAccessTokens();

    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await transform(
      TransformOptions.parse({
        documents: documents,
        excludePatterns: {
          pageNamePatterns: Array.isArray(options.excludePagePattern) ? options.excludePagePattern : undefined,
          nodeNamePatterns: Array.isArray(options.excludeNodePattern) ? options.excludeNodePattern : undefined,
          componentNamePatterns: Array.isArray(options.excludeComponentPattern) ? options.excludeComponentPattern : undefined,
          typographyNamePatterns: Array.isArray(options.excludeTypographyPattern) ? options.excludeTypographyPattern : undefined,
          colorNamePatterns: Array.isArray(options.excludeColorPattern) ? options.excludeColorPattern : undefined,
        },
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
