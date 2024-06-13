import { OpenAPI as FigmaClientSettings, getTeamProjects } from '@figpot/src/clients/figma';
import { OpenAPI as PenpotClientSettings, postCommandGetTeamRecentFiles } from '@figpot/src/clients/penpot';

FigmaClientSettings.HEADERS = {
  'X-Figma-Token': process.env.FIGMA_ACCESS_TOKEN || '',
};

PenpotClientSettings.HEADERS = {
  Authorization: `Token ${process.env.PENPOT_ACCESS_TOKEN || ''}`,
};

export async function retrieveFromFigma() {
  const data = await getTeamProjects({ teamId: 'xxxxxxx' });

  console.log(data);
}

export async function pushToPenpot() {
  const data = await postCommandGetTeamRecentFiles({
    requestBody: {
      teamId: 'xxxxxxx',
    },
  });

  console.log(data);
}
