import { checkbox, input, select } from '@inquirer/prompts';
import assert from 'assert';

import {
  ErrorResponsePayloadWithErrorBoolean,
  LocalVariable,
  RGBA,
  getFile,
  getLocalVariables,
  getProjectFiles,
  getTeamProjects,
} from '@figpot/src/clients/figma';
import { DocumentOptionsType, getFigmaDocumentPath } from '@figpot/src/features/document';

export type FigmaDefinedColor = {
  id: LocalVariable['id'];
  key: LocalVariable['key'];
  name: LocalVariable['name'];
  description: LocalVariable['description'];
  value?: RGBA;
};

export function processDocumentsParametersFromInput(parameters: string[]): DocumentOptionsType[] {
  return parameters.map((parameter) => {
    const parts = parameter.split(':');

    return {
      figmaDocument: parts[0],
      penpotDocument: parts[1], // May be undefined if the user wants a new Penpot document
    };
  });
}

export async function retrieveColors(documentId: string): Promise<FigmaDefinedColor[]> {
  const colors: FigmaDefinedColor[] = [];

  try {
    const localVariablesResult = await getLocalVariables({ fileKey: documentId });
    for (const localVariable of Object.values(localVariablesResult.meta.variables)) {
      if (localVariable.resolvedType === 'COLOR') {
        // TODO: we don't support reading values from their API since variables bounds can be nested
        // but also because they use "collection modes" that could be switch.
        // The easier for us is to set the value from the hardcoded values of nodes (may be a problem in some cases if multiple mode applied, but it's unlikely)
        // Ref: https://forum.figma.com/t/how-to-access-variable-alias-value-from-another-collection/53203/4
        colors.push({
          id: localVariable.id,
          key: localVariable.key,
          name: localVariable.name,
          description: localVariable.description,
        });
      }
    }
  } catch (error) {
    const body = (error as unknown as any).body as ErrorResponsePayloadWithErrorBoolean;

    if (body.status === 403 && body.message.includes('files:read')) {
      console.warn(
        `exact color variables names won't be transferred since Figma requires the most expensive plan just to get variables you defined (Enterprise plan you seem to not have)...`
      );
    } else {
      throw error;
    }
  }

  return colors;
}

export async function retrieveDocument(documentId: string) {
  const documentTree = await getFile({
    fileKey: documentId,
    geometry: 'paths', // Needed to have all properties into nodes
  });

  // TODO: return the metadata

  return documentTree;
}

export async function retrieveDocumentsFromInput(): Promise<string[]> {
  // Teams cannot be gotten so expecting the user to precise it
  const teamId = await input({ message: 'What is the team ID to list the documents from? (you can see it inside the URL once on Figma)' });
  const teamAndProjects = await getTeamProjects({ teamId: teamId });

  const projectId = await select({
    message: `Inside the team "${teamAndProjects.name}", select the project to list documents from`,
    choices: teamAndProjects.projects.map((project) => {
      return {
        name: project.name,
        value: project.id,
        description: `(${project.id})`,
      };
    }),
  });

  const project = teamAndProjects.projects.find((p) => p.id === projectId);
  assert(project);

  const projectAndFiles = await getProjectFiles({ projectId: projectId });

  const documentsKeys = await checkbox({
    message: `Inside the project "${project.name}", select the documents to synchronize into Penpot`,
    choices: projectAndFiles.files.map((file) => {
      return {
        name: file.name,
        value: file.key,
        description: `(${file.key})`,
      };
    }),
  });

  if (!documentsKeys.length) {
    throw new Error('you should have selected at least a document');
  }

  return documentsKeys;
}
