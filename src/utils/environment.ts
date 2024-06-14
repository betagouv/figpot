import { password } from '@inquirer/prompts';

import { OpenAPI as FigmaClientSettings } from '@figpot/src/clients/figma';
import { OpenAPI as PenpotClientSettings } from '@figpot/src/clients/penpot';
import { ConfigSchema } from '@figpot/src/models/entities/environment';

export const config = {
  figmaAccessToken: '',
  penpotAccessToken: '',
};

export async function ensureAccessTokens() {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    const figmaAccessToken = await password({ message: 'What is your Figma access token (can be created from your Figma account)?' });
    const penpotAccessToken = await password({ message: 'What is your Penpot access token (can be created from your Penpot account)?' });

    config.figmaAccessToken = figmaAccessToken;
    config.penpotAccessToken = penpotAccessToken;
  } else {
    config.figmaAccessToken = result.data.FIGMA_ACCESS_TOKEN;
    config.penpotAccessToken = result.data.PENPOT_ACCESS_TOKEN;
  }

  FigmaClientSettings.HEADERS = {
    'X-Figma-Token': config.figmaAccessToken,
  };

  PenpotClientSettings.HEADERS = {
    Authorization: `Token ${config.penpotAccessToken}`,
  };
}
