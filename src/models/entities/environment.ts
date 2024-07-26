import { z } from 'zod';

export const AccessTokenConfigSchema = z.object({
  FIGMA_ACCESS_TOKEN: z.string().min(1),
  PENPOT_ACCESS_TOKEN: z.string().min(1),
});
export type AccessTokenConfigSchemaType = z.infer<typeof AccessTokenConfigSchema>;

export const CredentialsConfigSchema = z.object({
  PENPOT_USER_EMAIL: z.string().email(),
  PENPOT_USER_PASSWORD: z.string().min(1),
});
export type CredentialsConfigSchemaType = z.infer<typeof CredentialsConfigSchema>;
