import { OpenAPI as PenpotClientSettings, postCommandGetTeamRecentFiles } from '@figpot/src/clients/penpot';
import { config } from '@figpot/src/utils/environment';

PenpotClientSettings.HEADERS = {
  Authorization: `Token ${config.penpotAccessToken}`,
};

export async function push() {
  const data = await postCommandGetTeamRecentFiles({
    requestBody: {
      teamId: 'xxxxxxx',
    },
  });

  console.log(data);
}
