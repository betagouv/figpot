import { input, password } from '@inquirer/prompts';

import { OpenAPI as FigmaClientSettings } from '@figpot/src/clients/figma';
import { OpenAPI as PenpotClientSettings } from '@figpot/src/clients/penpot';
import { AccessTokenConfigSchema, CredentialsConfigSchema } from '@figpot/src/models/entities/environment';

if (typeof process.env.PENPOT_BASE_URL === 'string') {
  // Can be used in case of a self-hosted instance
  PenpotClientSettings.BASE = `${process.env.PENPOT_BASE_URL}/api/rpc`;
}

export const config = {
  figmaAccessToken: '',
  penpotAccessToken: '',
  penpotUserEmail: '',
  penpotUserPassword: '',
};

export async function ensureAccessTokens() {
  const result = AccessTokenConfigSchema.safeParse(process.env);

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

export async function ensureCredentials() {
  const result = CredentialsConfigSchema.safeParse(process.env);

  if (!result.success) {
    console.log(
      `The API access token cannot be used to reach the UI for hydration, you have to provide your Penpot credentials so we generate a UI access token`
    );
    const penpotUserEmail = await input({ message: 'What is your Penpot user email?' });
    const penpotUserPassword = await password({ message: 'What is your Penpot user password?' });

    config.penpotUserEmail = penpotUserEmail;
    config.penpotUserPassword = penpotUserPassword;
  } else {
    config.penpotUserEmail = result.data.PENPOT_USER_EMAIL;
    config.penpotUserPassword = result.data.PENPOT_USER_PASSWORD;
  }
}
