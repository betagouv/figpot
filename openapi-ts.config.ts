import { defineConfig } from '@hey-api/openapi-ts';

// Errors are thrown (instead of being returned as `{ error }`) so a failing call cannot be mistaken for a success.
// Our own settings (base URL, credentials, error wrapping, big JSON parsing) are set at runtime from `src/clients/setup.ts`
const plugins = [
  { name: '@hey-api/client-fetch', throwOnError: true },
  // Keep the names of the specifications (e.g. `RGBA` instead of `Rgba`)
  { name: '@hey-api/typescript', definitions: { case: 'preserve' } },
  '@hey-api/sdk',
] as const;

// An object schema without any property (Figma uses them as placeholders for traits not documented yet) would be typed
// with an index signature `[key: string]: unknown`, and since nodes are intersections of traits, any property check on
// a node would then give `unknown`. Making them neutral like no schema at all.
function neutralizeEmptyObjectSchemas(spec: any) {
  for (const schema of Object.values<any>(spec.components?.schemas ?? {})) {
    if (
      schema.type === 'object' &&
      schema.properties &&
      Object.keys(schema.properties).length === 0 &&
      schema.additionalProperties === undefined &&
      !schema.allOf &&
      !schema.oneOf &&
      !schema.anyOf
    ) {
      delete schema.type;
      delete schema.properties;
    }
  }
}

// Generated from the committed specifications (updated with `npm run client:update`) so the generated clients can be checked against them
export default defineConfig([
  {
    input: 'src/clients/specs/figma.yaml',
    output: 'src/clients/figma',
    parser: { patch: { input: neutralizeEmptyObjectSchemas } },
    plugins: [...plugins],
  },
  {
    input: 'src/clients/specs/penpot.json',
    output: 'src/clients/penpot',
    parser: { patch: { input: neutralizeEmptyObjectSchemas } },
    plugins: [...plugins],
  },
]);
