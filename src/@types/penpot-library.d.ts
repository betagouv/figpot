// The parts of the Penpot library (`@penpot/library`, shipped without types) figpot uses: a file builder that computes the
// geometry Penpot derives itself, like the content of a boolean from its operands
declare module '@penpot/library' {
  export interface BuildContext {
    addFile(params: { name: string }): string;
    addPage(params: { name: string }): string;
    addGroup(params: object): string;
    closeGroup(): void;
    addBool(params: { groupId: string; type: string }): string;
    addPath(params: object): string;
    addRect(params: object): string;
    addCircle(params: object): string;
    getInternalState(): {
      currentFileId: string;
      files: Record<string, { data: { pagesIndex: Record<string, { objects: Record<string, { content?: string }> }> } }>;
    };
  }

  export function createBuildContext(options?: object): BuildContext;
}
