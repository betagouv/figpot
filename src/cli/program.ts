import { Command, InvalidArgumentError, Option } from '@commander-js/extra-typings';
import { $ } from 'execa';
import path from 'path';

import {
  CompareOptions,
  DocumentOptionsType,
  HydrateOptions,
  RetrieveOptions,
  SetOptions,
  SynchronizeOptions,
  TransformOptions,
  compare,
  defaultPushChunkSize,
  hydrate,
  resolveDefaultDataDir,
  resolveDocumentDestinations,
  retrieve,
  set,
  synchronize,
  transform,
} from '@figpot/src/features/document';
import { FigmaFileMetaCache, processDocumentsParametersFromInput, retrieveDocumentsFromInput } from '@figpot/src/features/figma';
import { ensureAccessTokens, ensureCredentials } from '@figpot/src/utils/environment';
import { getMemoryAdvice, getMemoryContext } from '@figpot/src/utils/memory';

export const program = new Command();

program.name('@betagouv/figpot').description('CLI to perform actions between Figma and Penpot').version('0.0.0');

// A crash due to the memory cannot be reported since the process is killed, so warning ahead about a risky configuration
program.hook('preAction', () => {
  const memoryAdvice = getMemoryAdvice(getMemoryContext(), false);

  if (memoryAdvice) {
    console.warn(memoryAdvice);
  }
});

const deps = program.command('deps').description('install required dependencies to use the package');
const document = program.command('document').description('manage documents');
const debugDocument = document.command('debug').description('manage documents step by step to debug');

const documentsOption = new Option('-d, --document [documents...]', 'figma document id as source and penpot one as target (`-d figmaId:penpotId`)');
const librariesOption = new Option(
  '-l, --library [libraries...]',
  'declare a Penpot library file used by your documents in the form `figmaId:penpotId` (required when your Figma file consumes published components from another Figma file)'
);
const skipLibrariesOption = new Option(
  '--skip-libraries',
  'skip remote-component resolution, instances of remote components will remain detached (helpful when the Figma access token lacks "Library assets" scope)'
);
const detachLibrariesOption = new Option(
  '--detach-library [figmaFileIds...]',
  'Figma library file referenced by your documents whose component instances must be kept as plain shapes instead of being bound (helpful to avoid circular dependencies between libraries), any other undeclared library still requires a decision. Before detaching an unexpected library, check it is not only referenced by overrides on hidden layers inside instances (not listed by the Figma libraries panel)'
);
const skipInferringLibrariesOption = new Option(
  '--skip-inferring-libraries',
  "consider only the libraries explicitly declared with -l/--library; do not try to infer library file IDs from remote component and style keys. It may help saving a lot of requests for subsequent runs when we know keys inference won't bring more libraries"
);
const continuousIntegrationOption = new Option('-ci, --ci', 'answer "yes" to all command prompts, use it with caution');
const syncMappingWithGitOption = new Option(
  '--sync-mapping-with-git',
  'save and restore the mapping file with Git (must be run inside a repository with "git" command accessible'
);
const serverValidationOption = new Option(
  '--no-server-validation',
  'skip Penpot validation server-side, useful for big files or for a Penpot instance with limited resources, use it with caution'
);
const pushChunkSizeOption = new Option(
  '--push-chunk-size <megabytes>',
  `maximum size of the modifications sent to Penpot per request (default ${defaultPushChunkSize}). Lower it if pushes fail with a gateway timeout (the Penpot instance takes too long to apply them), raise it to push faster on a powerful instance while staying a bit under its "PENPOT_HTTP_SERVER_MAX_BODY_SIZE" (30MB by default)`
).argParser((value) => {
  const size = Number(value);

  if (!(size > 0)) {
    throw new InvalidArgumentError('it must be a positive number of megabytes');
  }

  return size;
});
const useCachedFigmaDataOption = new Option(
  '--use-cached-figma-data',
  'reuse the previously retrieved Figma data (tree, colors, typographies) from local cache instead of fetching it again (useful to avoid Figma rate limits or plan-based restrictions during iteration)'
);
const dataDirOption = new Option(
  '--data-dir <dataDir>',
  'override the directory used for figpot\'s local state (cached Figma trees, mappings, exports, media, text-paths). Falls back to FIGPOT_DATA_DIR, then to "./data" relative to the current working directory'
);

function resolveDataDirectoryFromCli(cliValue: string | undefined): string {
  return cliValue ? path.resolve(cliValue) : resolveDefaultDataDir();
}

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
  .addOption(librariesOption)
  .addOption(skipLibrariesOption)
  .addOption(detachLibrariesOption)
  .addOption(skipInferringLibrariesOption)
  .addOption(excludePagePatternsOption)
  .addOption(excludeNodePatternsOption)
  .addOption(excludeComponentPatternsOption)
  .addOption(excludeTypographyPatternsOption)
  .addOption(excludeColorPatternsOption)
  .addOption(replaceFontPatternsOption)
  .addOption(syncMappingWithGitOption)
  .addOption(serverValidationOption)
  .addOption(pushChunkSizeOption)
  .addOption(useCachedFigmaDataOption)
  .addOption(dataDirOption)
  .addOption(continuousIntegrationOption)
  .option('-nh, --no-hydrate', 'prevent performing hydratation after the synchronization')
  .option('-ht, --hydrate-timeout <hydrateTimeout>', 'specify a maximum of duration for hydratation')
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    if (options.hydrate) {
      await ensureCredentials(!options.ci);
    }

    const dataDir = resolveDataDirectoryFromCli(options.dataDir);

    let documents: DocumentOptionsType[];
    if (!options.document || options.document === true) {
      throw new Error('please specify at least one Figma document to synchronize');
    } else {
      documents = processDocumentsParametersFromInput(options.document);
    }

    let libraries = Array.isArray(options.library) ? processDocumentsParametersFromInput(options.library) : [];

    // Shared cache so every `GET /v1/files/:key/meta` is fired at most once for the whole CLI command
    const figmaMetaCache = new FigmaFileMetaCache();

    // Fill in any missing `:penpotId` (the user typed just `-d <figmaId>` or `-l <figmaId>`)
    // Note: resolution needs to prompt the user so it can't happen inside `synchronize` after Zod has rejected the input
    documents = await resolveDocumentDestinations(dataDir, documents, !options.ci, figmaMetaCache);
    libraries = await resolveDocumentDestinations(dataDir, libraries, !options.ci, figmaMetaCache);

    await synchronize(
      SynchronizeOptions.parse({
        dataDir: dataDir,
        documents: documents,
        libraries: libraries,
        skipLibraries: options.skipLibraries || false,
        detachedLibraries: Array.isArray(options.detachLibrary) ? options.detachLibrary : [],
        skipInferringLibraries: options.skipInferringLibraries || false,
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
        pushChunkSize: options.pushChunkSize,
        prompting: !options.ci,
        useCachedFigmaData: options.useCachedFigmaData || false,
      }),
      figmaMetaCache
    );
  });

document
  .command('hydrate')
  .description('hydrate Penpot documents after a synchronization')
  .addOption(documentsOption)
  .option('-t, --timeout <timeout>', 'specify a maximum of duration for hydratation')
  .addOption(dataDirOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureCredentials(!options.ci);

    const dataDir = resolveDataDirectoryFromCli(options.dataDir);

    let documents: DocumentOptionsType[];
    if (!options.document || options.document === true) {
      throw new Error('please specify both figma and penpot documents to synchronize');
    } else {
      documents = processDocumentsParametersFromInput(options.document);
    }

    await hydrate(
      HydrateOptions.parse({
        dataDir: dataDir,
        documents: documents,
        timeout: options.timeout || null,
      })
    );
  });

debugDocument
  .command('retrieve')
  .description('save Figma documents locally')
  .addOption(documentsOption)
  .addOption(librariesOption)
  .addOption(skipLibrariesOption)
  .addOption(skipInferringLibrariesOption)
  .addOption(syncMappingWithGitOption)
  .addOption(useCachedFigmaDataOption)
  .addOption(dataDirOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    const dataDir = resolveDataDirectoryFromCli(options.dataDir);
    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];
    const libraries = Array.isArray(options.library) ? processDocumentsParametersFromInput(options.library) : [];

    await retrieve(
      RetrieveOptions.parse({
        dataDir: dataDir,
        documents: documents,
        libraries: libraries,
        syncMappingWithGit: options.syncMappingWithGit || false,
        prompting: !options.ci,
        useCachedFigmaData: options.useCachedFigmaData || false,
        skipLibraries: options.skipLibraries || false,
        skipInferringLibraries: options.skipInferringLibraries || false,
      })
    );
  });

debugDocument
  .command('transform')
  .description('transform Figma documents format to Penpot one')
  .addOption(documentsOption)
  .addOption(librariesOption)
  .addOption(excludePagePatternsOption)
  .addOption(excludeNodePatternsOption)
  .addOption(excludeComponentPatternsOption)
  .addOption(excludeTypographyPatternsOption)
  .addOption(excludeColorPatternsOption)
  .addOption(replaceFontPatternsOption)
  .addOption(syncMappingWithGitOption)
  .addOption(dataDirOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    const dataDir = resolveDataDirectoryFromCli(options.dataDir);
    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];
    const libraries = Array.isArray(options.library) ? processDocumentsParametersFromInput(options.library) : [];

    await transform(
      TransformOptions.parse({
        dataDir: dataDir,
        documents: documents,
        libraries: libraries,
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
  .addOption(dataDirOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    const dataDir = resolveDataDirectoryFromCli(options.dataDir);
    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await compare(
      CompareOptions.parse({
        dataDir: dataDir,
        documents: documents,
      })
    );
  });

debugDocument
  .command('set')
  .description('execute operations')
  .addOption(documentsOption)
  .addOption(serverValidationOption)
  .addOption(pushChunkSizeOption)
  .addOption(dataDirOption)
  .addOption(continuousIntegrationOption)
  .action(async (options) => {
    await ensureAccessTokens(!options.ci);

    const dataDir = resolveDataDirectoryFromCli(options.dataDir);
    const documents = Array.isArray(options.document) ? processDocumentsParametersFromInput(options.document) : [];

    await set(
      SetOptions.parse({
        dataDir: dataDir,
        documents: documents,
        serverValidation: options.serverValidation,
        pushChunkSize: options.pushChunkSize,
        prompting: !options.ci,
      })
    );
  });
