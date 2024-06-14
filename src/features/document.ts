import { z } from 'zod';

export const RetrieveOptions = z.object({
  figmaDocuments: z.array(z.string()),
});
export type RetrieveOptionsType = z.infer<typeof RetrieveOptions>;

export async function retrieve(options: RetrieveOptionsType) {
  // Make sure all documents are reachable with this access
  // Get the entire tree for each with vectors paths
  // Save each with metadata
  for (const documentId of options.figmaDocuments) {
  }
}

export const TransformOptions = z.object({
  figmaDocuments: z.array(z.string()),
  penpotDocuments: z.array(z.string()).optional(),
});
export type TransformOptionsType = z.infer<typeof TransformOptions>;

export async function transform(options: TransformOptionsType) {
  // Go from the Figma format to the Penpot one
}

export const CompareOptions = z.object({
  figmaDocuments: z.array(z.string()),
  penpotDocuments: z.array(z.string()).optional(),
});
export type CompareOptionsType = z.infer<typeof CompareOptions>;

export async function compare(options: CompareOptionsType) {
  // Take the Penpot one that has Figma node IDs and use the one from the mappings
  // Get documents from Penpot if already synchronized in the past
  // Calculate operations needed on the current hosted tree to match the Figma documents state
}

export const SetOptions = z.object({
  figmaDocuments: z.array(z.string()),
  penpotDocuments: z.array(z.string()).optional(),
});
export type SetOptionsType = z.infer<typeof SetOptions>;

export async function set(options: SetOptionsType) {
  // Execute operations onto Penpot instance to match the Figma documents
}

export const SynchronizeOptions = z.object({
  figmaDocuments: z.array(z.string()),
  penpotDocuments: z.array(z.string()).optional(),
});
export type SynchronizeOptionsType = z.infer<typeof SynchronizeOptions>;

export async function synchronize(options: SynchronizeOptionsType) {
  await retrieve(options);
  await transform(options);
  await compare(options);
  await set(options);
}
