import { postCommandGetTeamRecentFiles } from '@figpot/src/clients/penpot';

export async function push() {
  const data = await postCommandGetTeamRecentFiles({
    requestBody: {
      teamId: 'xxxxxxx',
    },
  });

  console.log(data);
}
