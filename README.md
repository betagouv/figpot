# figpot

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> [!IMPORTANT]
> The package is implemented and has been tested with a custom Penpot instance. To be widely used the Penpot SaaS must be patched... Be patient and follow the issue https://tree.taiga.io/project/penpot/us/8372 ⏱️🚀

This library is a Figma to Penpot converter and synchronizer, it will fit your needs:

- To migrate from Figma to Penpot _(one-time transfer)_
- To provide your design system onto Penpot while keeping Figma as a source of truth _(incremental transfers)_
  - It can be automated and requires no intervention
  - Across synchronizations any file element will keep its unique identifier, so users relying on your file won't have bindings broken

## Usage

### One-time transfer

Prepare the minimal information:

1. Open your [Figma](https://www.figma.com/files/) document inside the browser and copy its identifier. _(For `https://www.figma.com/design/CptbnRHeDv3pzOai91abcd/` the ID is `CptbnRHeDv3pzOai91abcd`)_
2. Open [Penpot](https://design.penpot.app/) and create an empty file, and copy its identifier. _(For `https://design.penpot.app/#/workspace/xxxxx/3d04e89b-bff0-8115-8004-bc14b0d50123?page-id=yyyyy` the ID is `3d04e89b-bff0-8115-8004-bc14b0d50123`)_

Make sure to have [Node.js](https://nodejs.org/) installed and simply run:

```shell
npx figpot deps # required to have a 100% complete synchronization, if not wanted use `--no-hydrate` on the following command
npx figpot document synchronize -d CptbnRHeDv3pzOai91abcd:3d04e89b-bff0-8115-8004-bc14b0d50123
```

The command will then ask you for tokens required to reach both Figma and Penpot. To avoid typing them each time, have a look at the `Usage > Advanced` section.

_Note: Penpot user email and password are required to synchronize final details simulating a browser locally. If needed you can skip this with the parameter `--no-hydrate`. See the FAQ to better understand the hydratation process._

### Incremental transfers

To have a real incremental experience the library needs to remember the bindings between Figma elements and those into Penpot. This takes place into a file named `.../figpot/documents/figma_$ID/export/penpot_$ID/mapping.json` that is saved locally.

If you intend to perform synchronizations from a new machine, or from a server that resets its storage at each start, you need to make sure saving and restoring this file each time.

### Avoid command prompts

#### Variables

It's possible to prefill some environment variables to avoid typing information each time:

- `FIGMA_ACCESS_TOKEN` _(the token can be created from your account settings under `Personal access tokens` section)_
- `PENPOT_ACCESS_TOKEN` _(the token can be created from your account settings under `Access tokens` tab)_
- `PENPOT_USER_EMAIL` _(email used for your account)_
- `PENPOT_USER_PASSWORD` _(password used for your account)_

Optional ones:

- `PENPOT_BASE_URL` _(by default it's `https://design.penpot.app/` but it has to be changed in case you use a custom Penpot instance)_

#### Warnings

Warnings to manually skip are emitted if:

- Your file size goes over Penpot recommandations _(see the FAQ for more details)_
- When synchronizing with no previous `mapping.json` _(we want to make sure you won't override a Penpot file by mistake)_

In case of a CI/CD pipeline you want to automate this, you can use `--ci` as parameter to answer "yes" to all confirm prompts. Use it with caution.

### More advanced usage

It's possible to:

- Filter Figma elements by names (it can be for colors, nodes, typographies, components)
- Replace fonts that you don't want to end into Penpot (it could be a defect on a Figma document you cannot edit)
- Process multiple synchronizations in 1 command

Please refer to the "Frequently Asked Questions" or to the commands documentation with `npx figpot --help`.

## Frequently Asked Questions

### Some Figma information seems lost during the transfer?

Make sure the Figma file you try to synchronize is in one of your workspace, otherwise the Figma access token won't be able to retrieve extra information like components or styles for colors and typographies.

It's also possible either this plugin does not implement the conversion yet, or that Penpot does not support this feature. In both cases, you are welcome to open an issue on the appropriate repository.

### What is the purpose of the hydratation step?

"Hydratation" in the context of `figpot` is when we use a browser to have the Penpot file ready to use.

In fact, our core library is transforming and giving all the Figma information to Penpot but the latter relies on a few operations that only happen when the document is open into a browser:

- It creates thumbnails for some elements
- It gives each paragraph part a graphical position that cannot be inferred from the Figma data

So, at the end of a synchronization of "raw data", we hydrate the Penpot file by opening a hidden browser that will wait for those 2 operations to be done on all pages.

There are 2 drawbacks to this:

- It requires us to ask for your Penpot credentials (the API access token cannot be used to load the user interface)
- It is more compute-intensive (due to running a browser while rendering the entire Penpot file)

You can skip this final step with `--no-hydrate`, but you have to keep in mind the first user going onto the file inside his own browser may have to wait a few minutes the time the file is completly ready (depending on how big the file is). And in case the first user is a visitor through a link to share, this one won't see the exact result despite waiting because he has no rights for his file fetching to update the file.

_Note: hydratation pushes updates to Penpot only when changes have been performed, most of the time this should be quick for a stable file._

### How to easily save `mapping.json` across synchronizations?

If you are doing this from your own computer, in most cases you have nothing to do since the file is already persisted on the storage. If you cannot allow losing bindings you can go a step further by managing backups of this file:

- Either with a manual backup (copy to an external storage)
- Or by tracking the file with a Cloud storage service (Google Drive, etc.)
- Or by using a Git repository

Since we already rely on Git to develop this library, we chose to provide a helper for Git repositories.

The idea is that if you run `figpot` from a cloned repository, you are able to use the parameter `--sync-mapping-with-git` so it fetches the latest commits before starting, and it pushes the mapping file to the current branch once modified.

**Please have a look at [`penpot-dsfr`](https://github.com/betagouv/penpot-dsfr) to see how a dedicated repository is used to regularly synchronize a few files from Figma to Penpot.** Their use case is to effortlessly maintain a Penpot version of their design system from Figma.

_Note: the file is pushed before updating the Penpot file. This way, in case of a partial update due to a failure, it prevents losing bindings already on the Penpot file and starting from scratch again._

### What if Penpot is laggy or crashing after synchronization?

In you are in the case where Penpot lags so much that's unusable:

- Either you have too few memory available
- Or the Figma file size is over what Penpot can handle

First of all, remember that Penpot keeps evolving and is yet not as optimized as Figma can be. They are aware of people being able to use files onto Figma but not onto Penpot. They are currently rebuilding the rendering engine to improve this.

In the meantime, `figpot` provides a way to exclude elements from the Figma file like `--exclude-page-pattern` and `--exclude-node-pattern`. This can be helpful to reduce the number of elements to push to Penpot.

An example of application would be:

> My team has a design system with light and dark themes into 1 Figma file, Penpot cannot handle this, so to make it usable into Penpot we decided to exclude all dark elements from the file. It has reduced by 2 the number of elements.

### How to make big files not crashing `figpot`?

Your memory needs to handle both Figma and Penpot trees at the same time to compare them. Even if the library optimizes some operations, this is the greedy operation that cannot be much optimized and that totally depends on the memory capacity.

If you encounter issues like `JavaScript heap out of memory`, try to:

- Close any other application
- Make sure the command you run is not trying to synchronize multiple files at once
- Run the command on a computer with more memory (8GB or 16GB should be sufficient)
- Filter some nodes from the Figma file (they will be skipped)

### How to synchronize multiple Figma files while keeping their components references between each other?

Currently when you convert a Figma file with `figpot`, all instances of remote components will loose their "component definition link" since the dependencies files are maybe not what you want to synchronize. To ease the user experience, we decided tokeep this logic instead of assuming the library has to transfer all files (or almost all).

It may be implemented in the future, but it would require all expected files to be synchronized first, and the "binding operation" would appear after. This because Figma allows bidirectional dependencies ("file A" may rely on "file B" components, and "file B" may rely on "file A" components).

### How to set up a recurrent synchronization?

This library is not intended to do real time synchronization, and usually almost real time synchronization it's not even needed.

We advise you to run the synchronization twice a week. Trying to synchronize has no data integrity impact, but it consumes a lot of ressources for nothing if your file is quite stable (fetching, transforming, comparing...).

### What is the difference with `penpot-exporter-figma-plugin`?

[penpot-exporter-figma-plugin](https://github.com/penpot/penpot-exporter-figma-plugin) is a Figma plugin that allows exporting an archive containing converted information as Penpot format, that you need to import into Penpot then.

This project has been started before `figpot` but it didn't fulfill some use cases:

- It requires a manual intervention from the user _(despite browser actions can be automated, it would have not solved following issues)_
- There is no incremental logic, so an export will always result into a new Penpot file
- Keeping a custom font is tricky (needed to analyze the HTML code)
- It requires Figma to be launched into a browser, reducing by default your available memory to perform all the conversion calculation (possibly resulting in a crash for medium-sized files)
- For Figma files with a huge amount of elements, it may reach browser limits (resulting in a crash too)

All those "cons" are due to limitations being a Figma plugin, **for my initial use cases**. Their plugin is definitely great in case you have tiny files to transfer just once, without dealing with `npx` or `npm`. And to be fair, I reused a great part of their transformers (which saved me time, but will also help both librairies to benefit from the other one improvements).

### Why `mapping.json` keeps growing despite deleting elements?

The choice has been done to keep all file mappings done in the past so:

- in case of a deletion mistake on Figma followed by a rollback of the data, the Penpot file will continue to be stable
- it allows testing different `figpot` exclude settings without loosing the bindings

_If you feel confident that your Penpot file is not used as a dependency, you may choose to empty your file values... but it should be a rare use case._

## Contribute

If you didn't face a specific issue but you are willing to help, please have a look at the reported issues https://github.com/sneko/figpot/issues. I will do my best to address your work, but keep in mind the maintenance of this project is in my spare time or on the time of other contributors.

### Setup

Make sure to use a Node.js version aligned with one specified into `.nvmrc`. Then:

```shell
npm install
npm run setup # discard in Git changes produced in files `*/request.ts`, we have patch some for optimization. Note also we do not use fixed schema version since their SaaS API evolve all the time. We rely on types check to detect any breaking change so we can adjust our logic
copy .env.model .env.local
```

Open `.env.local` and fill it with information as for a normal library usage. Then you are able to run:

```shell
npm run cli document synchronize --- -d CptbnRHeDv3pzOai91abcd:3d04e89b-bff0-8115-8004-bc14b0d50123
```

**Do not use the default Penpot production instance (`https://design.penpot.app/`) while developing!** It would consume their resources whereas they allow anyone to play inside their staging environment `https://design.penpot.dev/` (this can be configured through the environment variable `PENPOT_BASE_URL`). _Also it's possible to use your own local Penpot instance but I feel it's overkill if you are not facing a mysterious issue you have to debug (see https://help.penpot.app/technical-guide/getting-started/#install-with-docker)._

### Testing

A lot of tests are missing in the current version but you may find some that can be run with:

```shell
npm run jest --- --ci --passWithNoTests "./src/features/document.spec.ts"
```

It would be great while contributing to mimic what's done inside `document.spec.ts` with the input tree and the output tree to confirm what you are developing or fixing is working. Don't forget to share the Figma file you based your work on (either with a public link or with a Figma binary export), it allows us to reproduce it our own hand.

### Debugging

All steps are independents and require passing the values by files to be easily debuggued or to be partially replayed in case of memory error. _(It has a negative impact of reloading values but it helped me dealing with huge files and debugging the synchronization. A toggle to disable this could be added for sure)_

If needed, you can reproduce a full `npm run cli document synchronize ...` command by doing in the same order:

1. `npm run cli document debug retrieve ...`
2. `npm run cli document debug transform ...`
3. `npm run cli document debug compare ...`
4. `npm run cli document debug set ...`
5. `npm run cli document hydrate ...`

[build-img]: https://github.com/sneko/figpot/actions/workflows/ci.yml/badge.svg?branch=main
[build-url]: https://github.com/sneko/figpot/actions/workflows/ci.yml
[downloads-img]: https://img.shields.io/npm/dt/figpot
[downloads-url]: https://www.npmtrends.com/figpot
[npm-img]: https://img.shields.io/npm/v/figpot
[npm-url]: https://www.npmjs.com/package/figpot
[issues-img]: https://img.shields.io/github/issues/sneko/figpot
[issues-url]: https://github.com/sneko/figpot/issues
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
