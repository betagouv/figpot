// Downloads the OpenAPI specifications the API clients are generated from (see `openapi-ts.config.ts`).
// They are committed so the generated clients can be checked against them, and so a release does not depend on
// their SaaS APIs evolving all the time. With `--check` it only warns when the committed ones are outdated.
import fs from 'fs/promises';
import path from 'path';

export const apiSpecs = [
  {
    name: 'Figma',
    url: 'https://raw.githubusercontent.com/figma/rest-api-spec/main/openapi/openapi.yaml',
    filePath: 'src/clients/specs/figma.yaml',
  },
  {
    name: 'Penpot',
    url: 'https://design.penpot.app/api/main/doc/openapi.json',
    filePath: 'src/clients/specs/penpot.json',
  },
];

// Penpot generates random examples on each request, they are removed so the specification only changes with the API
function removeExamples(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeExamples);
  } else if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'example' && key !== 'examples')
        .map(([key, item]) => [key, removeExamples(item)])
    );
  }

  return value;
}

async function downloadSpec(spec: (typeof apiSpecs)[number]): Promise<string> {
  const response = await fetch(spec.url);
  if (!response.ok) {
    throw new Error(`cannot download the ${spec.name} API specification: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();

  return spec.filePath.endsWith('.json') ? `${JSON.stringify(removeExamples(JSON.parse(content)), null, 2)}\n` : content;
}

const checkOnly = process.argv.includes('--check');
const outdatedSpecs: string[] = [];

for (const spec of apiSpecs) {
  const content = await downloadSpec(spec);

  if (checkOnly) {
    const committedContent = await fs.readFile(spec.filePath, 'utf-8').catch(() => null);

    if (committedContent !== content) {
      outdatedSpecs.push(spec.name);
    }
  } else {
    await fs.mkdir(path.dirname(spec.filePath), { recursive: true });
    await fs.writeFile(spec.filePath, content);

    console.log(`the ${spec.name} API specification has been saved into "${spec.filePath}"`);
  }
}

if (outdatedSpecs.length > 0) {
  // The `::warning::` prefix makes it visible as an annotation on GitHub Actions without failing the workflow
  console.log(
    `::warning::the ${outdatedSpecs.join(' and ')} API specification(s) changed since the API clients were generated, run "npm run client:update" to update them (and adjust our logic if the types check fails)`
  );
} else if (checkOnly) {
  console.log('the API specifications are up to date');
}
