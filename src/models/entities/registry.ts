import assert from 'assert';

import { MappingType } from '@figpot/src/features/document';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';

export interface BoundVariableRegistry {
  getColors(): Map<string, Color>;
  getTypographies(): Map<string, LibraryTypography>;
  getMapping(): MappingType;
}

export class PageRegistry implements BoundVariableRegistry {
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

  public getMapping() {
    return this.globalRegistry.getMapping();
  }

  public getColors(): Map<string, Color> {
    return this.globalRegistry.getColors();
  }

  public getTypographies(): Map<string, LibraryTypography> {
    return this.globalRegistry.getTypographies();
  }
}

export class Registry implements BoundVariableRegistry {
  protected readonly pagesRegistries: Map<string, PageRegistry> = new Map();
  protected readonly colors: Map<string, Color> = new Map();
  protected readonly typographies: Map<string, LibraryTypography> = new Map();
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

  public addTypography(typography: LibraryTypography) {
    assert(typography.id);

    this.typographies.set(typography.id, typography);
  }

  public getTypographies(): Map<string, LibraryTypography> {
    return this.typographies;
  }

  public getMapping() {
    return this.mapping;
  }
}