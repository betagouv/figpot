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

// Note: we do not use fixed schema versions since their SaaS API evolve all the time, we rely on types check to detect breaking changes
export default defineConfig([
  {
    input: 'https://raw.githubusercontent.com/figma/rest-api-spec/main/openapi/openapi.yaml',
    output: 'src/clients/figma',
    parser: { patch: { input: neutralizeEmptyObjectSchemas } },
    plugins: [...plugins],
  },
  {
    input: 'https://design.penpot.app/api/main/doc/openapi.json',
    output: 'src/clients/penpot',
    parser: { patch: { input: neutralizeEmptyObjectSchemas } },
    plugins: [...plugins],
  },
]);
