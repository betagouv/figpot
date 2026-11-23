import { input, password } from '@inquirer/prompts';

import { client as figmaClient } from '@figpot/src/clients/figma/client.gen';
import { client as penpotClient } from '@figpot/src/clients/penpot/client.gen';
// Registers our error handling on the clients
import '@figpot/src/clients/workaround';
import { AccessTokenConfigSchema, CredentialsConfigSchema } from '@figpot/src/models/entities/environment';

export const penpotBaseUrl = process.env.PENPOT_BASE_URL ?? 'https://design.penpot.app';
export const penpotApiBaseUrl = `${penpotBaseUrl}/api/main/methods`;

penpotClient.setConfig({ baseUrl: penpotApiBaseUrl });

// Captured from the latest Figma response so callers can inspect rate-limit metadata after an `ApiError` is thrown.
// The `ApiError` doesn't carry headers, so we stash them via a response interceptor.
// Reset on every response so a later non-429 call doesn't leave stale values around for a subsequent catch.
export const figmaRateLimitContext: { retryAfter: string | null; rateLimitType: string | null } = {
  retryAfter: null,
  rateLimitType: null,
};

figmaClient.interceptors.response.use((response) => {
  if (response.status === 429) {
    figmaRateLimitContext.retryAfter = response.headers.get('retry-after');
    figmaRateLimitContext.rateLimitType = response.headers.get('x-figma-rate-limit-type');
  } else {
    figmaRateLimitContext.retryAfter = null;
    figmaRateLimitContext.rateLimitType = null;
  }
  return response;
});

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

  figmaClient.setConfig({
    headers: {
      'X-Figma-Token': config.figmaAccessToken,
    },
  });

  // Penpot answers with Transit by default, whereas the generated client expects JSON
  penpotClient.setConfig({
    headers: {
      Accept: 'application/json',
      Authorization: getPenpotAuthorizationHeader(config.penpotAccessToken),
    },
  });
}

// An access token is sent as `Token <value>`. When the instance does not enable the `access-tokens` flag (no section in the profile
// to create one, and the backend ignores them), the session token of a logged-in browser (value of the `auth-token` cookie) can be
// used instead by prefixing it with `Bearer ` (supported since Penpot 2.12). An explicit `Token ` prefix is also accepted
export function getPenpotAuthorization(): string {
  return getPenpotAuthorizationHeader(config.penpotAccessToken);
}

export function getPenpotAuthorizationHeader(value: string): string {
  const trimmedValue = value.trim();

  return /^(Token|Bearer)\s+/i.test(trimmedValue) ? trimmedValue : `Token ${trimmedValue}`;
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
