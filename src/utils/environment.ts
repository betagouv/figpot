import { password } from '@inquirer/prompts';

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
  }
}
