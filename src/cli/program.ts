import { Command, Option } from '@commander-js/extra-typings';
import { $ } from 'execa';

import {
  CompareOptions,
  DocumentOptionsType,
  HydrateOptions,
  RetrieveOptions,
  SetOptions,
  SynchronizeOptions,
  TransformOptions,
  compare,
  hydrate,
  retrieve,
  set,
  synchronize,
  transform,
} from '@figpot/src/features/document';
import { processDocumentsParametersFromInput, retrieveDocumentsFromInput } from '@figpot/src/features/figma';
import { ensureAccessTokens, ensureCredentials } from '@figpot/src/utils/environment';

export const program = new Command();

program.name('@betagouv/figpot').description('CLI to perform actions between Figma and Penpot').version('0.0.0');

const deps = program.command('deps').description('install required dependencies to use the package');
const document = program.command('document').description('manage documents');
const debugDocument = document.command('debug').description('manage documents step by step to debug');

const documentsOption = new Option('-d, --document [documents...]', 'figma document id as source and penpot one as target (`-d figmaId:penpotId`)');
const continuousIntegrationOption = new Option('-ci, --ci', 'answer "yes" to all command prompts, use it with caution');
const syncMappingWithGitOption = new Option(
  '--sync-mapping-with-git',
  'save and restore the mapping file with Git (must be run inside a repository with "git" command accessible'
);
const serverValidationOption = new Option(
  '--no-server-validation',
  'skip Penpot validation server-side, useful for big files or for a Penpot instance with limited resources, use it with caution'
);
const useCachedFigmaDataOption = new Option(
  '--use-cached-figma-data',
  'reuse the previously retrieved Figma data (tree, colors, typographies) from local cache instead of fetching it again (useful to avoid Figma rate limits or plan-based restrictions during iteration)'
);

const patternInfo = '(use single quotes around the parameter to prevent your terminal to replace special characters)';
const excludePagePatternsOption = new Option(
  '-expp, --exclude-page-pattern [excludePagePatterns...]',
  `regexp applied on each page name ${patternInfo}`
);
const excludeNodePatternsOption = new Option(
  '-exnp, --exclude-node-pattern [excludeNodePatterns...]',
  `regexp applied on each node name ${patternInfo}`
);
const excludeComponentPatternsOption = new Option(
  '-excompp, --exclude-component-pattern [excludeComponentPatterns...]',
  `regexp applied on each component name ${patternInfo}`
);
const excludeTypographyPatternsOption = new Option(
  '-extp, --exclude-typography-pattern [excludeTypographyPatterns...]',
  `regexp applied on each typography name ${patternInfo}`
);
const excludeColorPatternsOption = new Option(
  '-excolp, --exclude-color-pattern [excludeColorPatterns...]',
  `regexp applied on each color name ${patternInfo}`
);

const replaceFontPatternsOption = new Option(
  '-rfp, --replace-font-pattern [replaceFontPatterns...]',
  `regexp + replacement family in the form '<regex>:<family>' — matched against the Figma fontFamily AND fontPostScriptName. Optionally append ':<weight>' and/or ':<normal|italic>' to also force the weight/style (useful when a single-weight Figma variant like 'Arial-Black' maps to a Penpot font registered at a different weight). Examples: '^Arial:Helvetica', '^Arial-Black$:Arial Black:400:normal' ${patternInfo}`
);

function formatReplaceFontPatterns(replaceFontPattern: string[]): object[] {
  return replaceFontPattern.map((patternSettings): object => {
    let remaining = patternSettings;

    // Peel optional trailing style (":normal" or ":italic")
    let setStyle: 'normal' | 'italic' | undefined;
    const styleMatch = remaining.match(/:(normal|italic)$/);
    if (styleMatch) {
      setStyle = styleMatch[1] as 'normal' | 'italic';
      remaining = remaining.slice(0, -styleMatch[0].length);
    }

    // Peel optional trailing weight (":<positive integer>")
    let setWeight: number | undefined;
    const weightMatch = remaining.match(/:([1-9]\d*)$/);
    if (weightMatch) {
      setWeight = parseInt(weightMatch[1], 10);
      remaining = remaining.slice(0, -weightMatch[0].length);
    }

    // Remaining is "<regex>:<family>" — use lastIndexOf to preserve colons inside the regex
    const lastIndex = remaining.lastIndexOf(':');
    if (lastIndex === -1) {
      throw new Error(
        `the --replace-font-pattern must contain a regexp and the replace family in the form of "^Arial:Helvetica" (optionally followed by ':<weight>' and/or ':<normal|italic>')`
      );
    }

    return {
      search: remaining.substring(0, lastIndex),
      set: remaining.substring(lastIndex + 1),
      setWeight,
      setStyle,
    };
  });
}

deps.action(async (options) => {
  console.log('Installing dependencies...');

  // Install dependencies by the hydratation step
  // ---
  // Reproducing the Playwright CLI install logic by code is too complex, so executing a raw command instead
  // (try to match the version from the dependency tree to make prevent breaking changes using a latest one)
  // Ref: https://github.com/microsoft/playwright/blob/7c55b94280b89cc2612c8b4fa5d93d60203b3259/packages/playwright-core/src/cli/program.ts#L115-L179
  await $({ stdio: 'inherit' })`npx --yes patchright@1.52.4 install --with-deps chromium`;

  console.log(
    `If you see a playwright warning message it's just because you run figpot outside a directory with a "node_modules", but this should be fine`
  );
});

document
  .command('synchronize')
  .description('synchronize Figma documents to Penpot ones')
  .addOption(documentsOption)
  .addOption(excludePagePatternsOption)
  .addOption(excludeNodePatternsOption)
  .addOption(excludeComponentPatternsOption)
  .addOption(excludeTypographyPatternsOption)
  .addOption(excludeColorPatternsOption)
  .addOption(replaceFontPatternsOption)
  .addOption(syncMappingWithGitOption)
  .addOption(serverValidationOption)
  .addOption(useCachedFigmaDataOption)
  .addOption(continuousIntegrationOption)
  .option('-nh, --no-hydrate', 'prevent performing hydratation after the synchronization')
  .option('-ht, --hydrate-timeout <hydrateTimeout>', 'specify a maximum of duration for hydratation')
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    if (options.hydrate) {
      await ensureCredentials(!options.ci);
    }

    let documents: DocumentOptionsType[];
    if (!options.document || options.document === true) {
      throw new Error('please specify both figma and penpot documents to synchronize');
      // TODO: disabling this for now until we implement the documents retrieval from Penpot
      // TODO: should deal with `options.ci` value
      // documents = (await retrieveDocumentsFromInput()).map((figmaDocument) => {
      //   return {
      //     figmaDocument: figmaDocument,
      //   };
      // });
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
        replaceFontPatterns: Array.isArray(options.replaceFontPattern) ? formatReplaceFontPatterns(options.replaceFontPattern) : [],
        hydrate: options.hydrate,
        hydrateTimeout: options.hydrateTimeout || null,
        syncMappingWithGit: options.syncMappingWithGit || false,
        serverValidation: options.serverValidation,
        prompting: !options.ci,
        useCachedFigmaData: options.useCachedFigmaData || false,
      })
    );
  });

document
  .command('hydrate')
  .description('hydrate Penpot documents after a synchronization')
  .addOption(documentsOption)
  .option('-t, --timeout <timeout>', 'specify a maximum of duration for hydratation')
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureCredentials(!options.ci);

    let documents: DocumentOptionsType[];
    if (!options.document || options.document === true) {
      throw new Error('please specify both figma and penpot documents to synchronize');
    } else {
      documents = processDocumentsParametersFromInput(options.document);
    }

    await hydrate(
      HydrateOptions.parse({
        documents: documents,
        timeout: options.timeout || null,
      })
    );
  });

debugDocument
  .command('retrieve')
  .description('save Figma documents locally')
  .addOption(documentsOption)
  .addOption(syncMappingWithGitOption)
  .addOption(useCachedFigmaDataOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await retrieve(
      RetrieveOptions.parse({
        documents: documents,
        syncMappingWithGit: options.syncMappingWithGit || false,
        prompting: !options.ci,
        useCachedFigmaData: options.useCachedFigmaData || false,
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
  .addOption(replaceFontPatternsOption)
  .addOption(syncMappingWithGitOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

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
        replaceFontPatterns: Array.isArray(options.replaceFontPattern) ? formatReplaceFontPatterns(options.replaceFontPattern) : [],
        syncMappingWithGit: options.syncMappingWithGit || false,
        prompting: !options.ci,
      })
    );
  });

debugDocument
  .command('compare')
  .description('compare Figma and Penpot documents to know what to operate')
  .addOption(documentsOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

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
  .addOption(serverValidationOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await set(
      SetOptions.parse({
        documents: documents,
        serverValidation: options.serverValidation,
        prompting: !options.ci,
      })
    );
  });
