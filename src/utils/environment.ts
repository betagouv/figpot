import { input, password } from '@inquirer/prompts';

import { OpenAPI as FigmaClientSettings } from '@figpot/src/clients/figma';
import { OpenAPI as PenpotClientSettings } from '@figpot/src/clients/penpot';
import { AccessTokenConfigSchema, CredentialsConfigSchema } from '@figpot/src/models/entities/environment';

export const penpotApiBaseUrl = `${process.env.PENPOT_BASE_URL ?? 'https://design.penpot.app'}/api/main/methods`;

// The generated client does `BASE + path` where `path` has no leading slash, so BASE must end with a trailing one
PenpotClientSettings.BASE = `${penpotApiBaseUrl}/`;

export const config = {
  figmaAccessToken: '',
  penpotAccessToken: '',
  penpotUserEmail: '',
  penpotUserPassword: '',
};

export async function ensureAccessTokens(prompting: boolean = true) {
  const result = AccessTokenConfigSchema.safeParse(process.env);

  if (!result.success) {
    if (prompting) {
      const figmaAccessToken = await password({
        message:
          'What is your Figma access token (can be created from your Figma account, with read-only scopes `File content, File metadata, Library assets, Library content, Projects, Team library content`)?',
      });
      const penpotAccessToken = await password({ message: 'What is your Penpot access token (can be created from your Penpot account)?' });

      config.figmaAccessToken = figmaAccessToken;
      config.penpotAccessToken = penpotAccessToken;
    } else {
      throw new Error(`prompting is disabled so $FIGMA_ACCESS_TOKEN and $PENPOT_ACCESS_TOKEN environment variables must be provided`);
    }
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

export async function ensureCredentials(prompting: boolean = true) {
  const result = CredentialsConfigSchema.safeParse(process.env);

  if (!result.success) {
    if (prompting) {
      console.log(
        `The API access token cannot be used to reach the UI for hydratation, you have to provide your Penpot credentials so we generate a UI access token`
      );
      const penpotUserEmail = await input({ message: 'What is your Penpot user email?' });
      const penpotUserPassword = await password({ message: 'What is your Penpot user password?' });

      config.penpotUserEmail = penpotUserEmail;
      config.penpotUserPassword = penpotUserPassword;
    } else {
      throw new Error(`prompting is disabled so $PENPOT_USER_EMAIL and $PENPOT_USER_PASSWORD environment variables must be provided`);
    }
  } else {
    config.penpotUserEmail = result.data.PENPOT_USER_EMAIL;
    config.penpotUserPassword = result.data.PENPOT_USER_PASSWORD;
  }
}
