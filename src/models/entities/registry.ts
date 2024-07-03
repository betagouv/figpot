import assert from 'assert';

import { MappingType } from '@figpot/src/features/document';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';

export class PageRegistry {
  protected readonly nodes: Map<string, PenpotNode> = new Map();
  protected readonly globalRegistry: Registry;

  constructor(globalRegistry: Registry) {
    this.globalRegistry = globalRegistry;
  }

  public addNode(node: PenpotNode) {
    assert(node.id);

    this.nodes.set(node.id, node);
  }

  public getNodes() {
    return this.nodes;
  }

  public mergeColorFallback(color: Color) {
    // Since Figma does not allow getting variables from
  }

  public getMapping() {
    return this.globalRegistry.getMapping();
  }

  public getColors(): Map<string, Color> {
    return this.globalRegistry.getColors();
  }
}

export class Registry {
  protected readonly pagesRegistries: Map<string, PageRegistry> = new Map();
  protected readonly colors: Map<string, Color> = new Map();
  protected readonly mapping: MappingType;

  constructor(mapping: MappingType) {
    this.mapping = mapping;
  }

  public newPage(penpotPageId: string): PageRegistry {
    const pageRegistry = new PageRegistry(this);

    this.pagesRegistries.set(penpotPageId, pageRegistry);

    return pageRegistry;
  }

  public addColor(color: Color) {
    assert(color.id);

    this.colors.set(color.id, color);
  }

  public getColors(): Map<string, Color> {
    return this.colors;
  }

  public getMapping() {
    return this.mapping;
  }
}
