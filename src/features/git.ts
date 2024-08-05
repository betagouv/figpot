import path from 'path';
import { simpleGit } from 'simple-git';

import { getFigmaToPenpotMappingPath } from '@figpot/src/features/document';

const __root_dirname = process.cwd();

export async function saveMappingToRepository(figmaDocumentId: string, penpotDocumentId: string) {
  const git = simpleGit();
  await git.addConfig('push.autoSetupRemote', 'true'); // If the remote branch does not exist the push will not fail

  const status = await simpleGit().status();

  const mappingPath = getFigmaToPenpotMappingPath(figmaDocumentId, penpotDocumentId);
  const relativeMappingPath = path.relative(__root_dirname, mappingPath);

  if (status.not_added.includes(relativeMappingPath) || status.modified.includes(relativeMappingPath)) {
    await git.add(relativeMappingPath);
    await git.commit(`chore: update the mapping file (${figmaDocumentId}:${penpotDocumentId})`);
    await git.push();

    console.log('pushing the modified mapping file to the Git branch');
  } else {
    console.log('skipping pushing the mapping file to the Git branch since it has not been modified');
  }
}

export async function restoreMappingFromRepository(figmaDocumentId: string, penpotDocumentId: string) {
  const git = simpleGit();

  await git.fetch();

  // Check the file was tracked by the remote branch to inform the user
  const branchSummary = await git.branch();
  const currentBranch = branchSummary.current;

  const tree = await git.raw(['ls-tree', '-r', currentBranch, '--name-only']);
  const trackedFiles = tree.split('\n');

  const mappingPath = getFigmaToPenpotMappingPath(figmaDocumentId, penpotDocumentId);
  const relativeMappingPath = path.relative(__root_dirname, mappingPath);

  if (trackedFiles.includes(relativeMappingPath)) {
    console.log('the latest mapping file has been retrieved from the Git remote branch');
  } else {
    console.log('no mapping file has been retrieved from the remote Git branch');
  }
}
