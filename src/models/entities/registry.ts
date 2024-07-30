import assert from 'assert';

import { Overrides } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { SyncGroups } from '@figpot/src/models/entities/penpot/traits/syncGroups';

export interface BoundVariableRegistry {
  getColors(): Map<string, Color>;
  getTypographies(): Map<string, LibraryTypography>;
  getComponents(): Map<string, LibraryComponent>;
  getMapping(): MappingType;
}

export interface AbstractRegistry extends BoundVariableRegistry {
  addNode(node: PenpotNode): void;
  newComponentScope(): ComponentRegistry;
  newComponentInstanceScope(overrides: Overrides[]): ComponentInstanceRegistry;
  getOverrides(nodeId: string): Overrides['overriddenFields'] | null;
}

export class ComponentInstanceRegistry implements AbstractRegistry {
  // This is helpful to know while browsing we are in a component instance
  protected readonly globalRegistry: Registry;
  protected readonly pageRegistry: PageRegistry;
  protected readonly overrides: Map<Overrides['id'], Overrides['overriddenFields']> = new Map();

  constructor(pageRegistry: PageRegistry, globalRegistry: Registry, overrides: Overrides[]) {
    this.pageRegistry = pageRegistry;
    this.globalRegistry = globalRegistry;

    for (const overridesPerNode of overrides) {
      this.overrides.set(overridesPerNode.id, overridesPerNode.overriddenFields);
    }
  }

  public newComponentScope(): ComponentRegistry {
    return this.pageRegistry.newComponentScope();
  }

  public newComponentInstanceScope(overrides: Overrides[]): ComponentInstanceRegistry {
    return this.pageRegistry.newComponentInstanceScope(overrides);
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

  public getOverrides(nodeId: string): Overrides['overriddenFields'] | null {
    return this.overrides.get(nodeId) || null;
  }
}

export class ComponentRegistry implements AbstractRegistry {
  // This is helpful to know while browsing we are in a component
  protected readonly globalRegistry: Registry;
  protected readonly pageRegistry: PageRegistry;

  constructor(pageRegistry: PageRegistry, globalRegistry: Registry) {
    this.pageRegistry = pageRegistry;
    this.globalRegistry = globalRegistry;
  }

  public newComponentScope(): ComponentRegistry {
    return this.pageRegistry.newComponentScope();
  }

  public newComponentInstanceScope(overrides: Overrides[]): ComponentInstanceRegistry {
    return this.pageRegistry.newComponentInstanceScope(overrides);
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

  public getOverrides(nodeId: string): Overrides['overriddenFields'] | null {
    return this.pageRegistry.getOverrides(nodeId);
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

  public newComponentInstanceScope(overrides: Overrides[]): ComponentInstanceRegistry {
    return new ComponentInstanceRegistry(this, this.globalRegistry, overrides);
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

  public getOverrides(nodeId: string): Overrides['overriddenFields'] | null {
    return null;
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
