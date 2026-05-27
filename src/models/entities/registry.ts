import { Component, Overrides, Style } from '@figpot/src/clients/figma';
import { MappingType } from '@figpot/src/features/document';
import {
  registerId,
  translateColorIdFromKey,
  translateComponentId,
  translateComponentMainShapeIdFromKey,
  translateTypographyIdFromKey,
} from '@figpot/src/features/translators/translateId';
import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
import { PenpotNode } from '@figpot/src/models/entities/penpot/node';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';
import { workaroundAssert as assert } from '@figpot/src/utils/assert';

export type ComponentBinding = {
  id: string;
  mainShapeId: string;
  file: string | undefined; // Penpot file ID, may be undefined if not listed as library
  isRemote: boolean;
};

export type StyleBinding = {
  id: string;
  file: string | undefined; // Penpot file ID, may be undefined if not listed as library
  isRemote: boolean;
};

export interface BoundVariableRegistry {
  getColors(): Map<string, Color>;
  getTypographies(): Map<string, LibraryTypography>;
  getComponents(): Map<string, LibraryComponent>;
  getMapping(): MappingType;
  getVariableTokenNames(): Map<string, string>;
  resolveComponent(figmaComponentNodeId: string): ComponentBinding | undefined;
  resolveStyle(figmaStyleNodeId: string, paintIndex?: number): StyleBinding | undefined;
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

  public getVariableTokenNames(): Map<string, string> {
    return this.pageRegistry.getVariableTokenNames();
  }

  public resolveComponent(figmaComponentNodeId: string): ComponentBinding | undefined {
    return this.pageRegistry.resolveComponent(figmaComponentNodeId);
  }

  public resolveStyle(figmaStyleNodeId: string, paintIndex?: number): StyleBinding | undefined {
    return this.pageRegistry.resolveStyle(figmaStyleNodeId, paintIndex);
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

  public getVariableTokenNames(): Map<string, string> {
    return this.pageRegistry.getVariableTokenNames();
  }

  public resolveComponent(figmaComponentNodeId: string): ComponentBinding | undefined {
    return this.pageRegistry.resolveComponent(figmaComponentNodeId);
  }

  public resolveStyle(figmaStyleNodeId: string, paintIndex?: number): StyleBinding | undefined {
    return this.pageRegistry.resolveStyle(figmaStyleNodeId, paintIndex);
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

  public getVariableTokenNames(): Map<string, string> {
    return this.globalRegistry.getVariableTokenNames();
  }

  public resolveComponent(figmaComponentNodeId: string): ComponentBinding | undefined {
    return this.globalRegistry.resolveComponent(figmaComponentNodeId);
  }

  public resolveStyle(figmaStyleNodeId: string, paintIndex?: number): StyleBinding | undefined {
    return this.globalRegistry.resolveStyle(figmaStyleNodeId, paintIndex);
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
  protected readonly variableTokenNames: Map<string, string> = new Map();
  protected figmaComponents: Record<string, Component> = {};
  protected libraryFiles: Map<string, string> = new Map();
  protected remoteComponentSourceFiles: Map<string, string> = new Map();
  protected figmaStyles: Record<string, Style> = {};
  protected remoteStyleSourceFiles: Map<string, string> = new Map();
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

  public registerVariableTokenNames(variableTokenNames: Map<string, string>) {
    for (const [figmaVariableId, tokenName] of variableTokenNames) {
      this.variableTokenNames.set(figmaVariableId, tokenName);
    }
  }

  public getVariableTokenNames(): Map<string, string> {
    return this.variableTokenNames;
  }

  // Seeds the cross-file component binding state (to call once at the start of a document transform)
  public registerComponentBindings(
    figmaComponents: Record<string, Component>,
    libraryFiles: Map<string, string>,
    remoteComponentSourceFiles: Map<string, string>
  ) {
    this.figmaComponents = figmaComponents;
    this.libraryFiles = libraryFiles;
    this.remoteComponentSourceFiles = remoteComponentSourceFiles;

    // For every locally-published component master (so not remote one), force the page tree shape id to be deterministic so cross-file referencing will work
    for (const [figmaNodeId, component] of Object.entries(figmaComponents)) {
      if (!component.remote) {
        registerId(figmaNodeId, translateComponentMainShapeIdFromKey(component.key), this.mapping);
      }
    }
  }

  // Seeds the cross-file style binding state (to call once at the start of a document transform)
  public registerStyleBindings(figmaStyles: Record<string, Style>, libraryFiles: Map<string, string>, remoteStyleSourceFiles: Map<string, string>) {
    this.figmaStyles = figmaStyles;
    this.libraryFiles = libraryFiles;
    this.remoteStyleSourceFiles = remoteStyleSourceFiles;
  }

  public resolveStyle(figmaStyleNodeId: string, paintIndex?: number): StyleBinding | undefined {
    const style = this.figmaStyles[figmaStyleNodeId];
    if (!style || !style.key) {
      return undefined; // Considered as not published
    }

    // Effective key carries an optional `_${paintIndex}` suffix for multi-paint FILL styles so each
    // generated color definition gets a distinct deterministic Penpot ID
    const effectiveKey = paintIndex !== undefined ? `${style.key}_${paintIndex}` : style.key;

    let id: string;
    if (style.styleType === 'FILL') {
      id = translateColorIdFromKey(effectiveKey);
    } else if (style.styleType === 'TEXT') {
      id = translateTypographyIdFromKey(effectiveKey);
    } else {
      // EFFECT styles ride the token cross-file path and GRID styles aren't cross-file-bound in Penpot
      return undefined;
    }

    if (!style.remote) {
      // The style is part of the current file being processed
      return { id, file: this.mapping.documents.get('current'), isRemote: false };
    }

    // For remote style the resolve the target Penpot file ID (but still using a fallback)
    const sourceFigmaFile = this.remoteStyleSourceFiles.get(style.key);
    const penpotLibraryFile = sourceFigmaFile !== undefined ? this.libraryFiles.get(sourceFigmaFile) : undefined;

    return { id, file: penpotLibraryFile, isRemote: true };
  }

  public resolveComponent(figmaComponentNodeId: string): ComponentBinding | undefined {
    const figmaComponent = this.figmaComponents[figmaComponentNodeId];
    if (!figmaComponent) {
      return undefined; // Considered as not published
    }

    const id = translateComponentId(figmaComponent.key);
    const mainShapeId = translateComponentMainShapeIdFromKey(figmaComponent.key);

    if (!figmaComponent.remote) {
      // The component is part of the current file being processed
      return { id, mainShapeId, file: this.mapping.documents.get('current'), isRemote: false };
    }

    // For remote component the resolve the target Penpot file ID (but still using a fallback)
    const sourceFigmaFile = this.remoteComponentSourceFiles.get(figmaComponent.key);
    const penpotLibraryFile = sourceFigmaFile !== undefined ? this.libraryFiles.get(sourceFigmaFile) : undefined;

    return { id, mainShapeId, file: penpotLibraryFile, isRemote: true };
  }

  public getMapping() {
    return this.mapping;
  }
}
