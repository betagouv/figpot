import assert from 'assert';

import { MappingType } from '@figpot/src/features/document';
import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';

export interface BoundVariableRegistry {
  getColors(): Map<string, Color>;
  getTypographies(): Map<string, LibraryTypography>;
  getComponents(): Map<string, LibraryComponent>;
  getMapping(): MappingType;
}

export interface AbstractRegistry extends BoundVariableRegistry {
  addNode(node: PenpotNode): void;
}

export class ComponentRegistry implements AbstractRegistry {
  // This is helpful to know while browsing we are in a component
  protected readonly globalRegistry: Registry;
  protected readonly pageRegistry: PageRegistry;

  constructor(pageRegistry: PageRegistry, globalRegistry: Registry) {
    this.pageRegistry = pageRegistry;
    this.globalRegistry = globalRegistry;
  }

  public addNode(node: PenpotNode) {
    this.pageRegistry.addNode(node);
  }

  public getNodes() {
    this.pageRegistry.getNodes();
  }

  public getMapping() {
    return this.pageRegistry.getMapping();
  }

  public getColors(): Map<string, Color> {
    return this.pageRegistry.getColors();
  }

  public getTypographies(): Map<string, LibraryTypography> {
    return this.pageRegistry.getTypographies();
  }

  public getComponents(): Map<string, LibraryComponent> {
    return this.pageRegistry.getComponents();
  }
}

export class PageRegistry implements AbstractRegistry {
  protected readonly nodes: Map<string, PenpotNode> = new Map();
  protected readonly globalRegistry: Registry;

  constructor(globalRegistry: Registry) {
    this.globalRegistry = globalRegistry;
  }

  public newComponentScope(): ComponentRegistry {
    return new ComponentRegistry(this, this.globalRegistry);
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

  public getComponents(): Map<string, LibraryComponent> {
    return this.globalRegistry.getComponents();
  }
}

export class Registry implements BoundVariableRegistry {
  protected readonly pagesRegistries: Map<string, PageRegistry> = new Map();
  protected readonly colors: Map<string, Color> = new Map();
  protected readonly typographies: Map<string, LibraryTypography> = new Map();
  protected readonly components: Map<string, LibraryComponent> = new Map();
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

  public addComponent(component: LibraryComponent) {
    assert(component.id);

    this.components.set(component.id, component);
  }

  public getComponents(): Map<string, LibraryComponent> {
    return this.components;
  }

  public getMapping() {
    return this.mapping;
  }
}
