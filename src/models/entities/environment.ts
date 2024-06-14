import { z } from 'zod';

export const ConfigSchema = z.object({
  FIGMA_ACCESS_TOKEN: z.string().min(1),
  PENPOT_ACCESS_TOKEN: z.string().min(1),
});
export type ConfigSchemaType = z.infer<typeof ConfigSchema>;
