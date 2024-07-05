import { LibraryComponent } from '@figpot/src/models/entities/penpot/component';
import { PenpotPage } from '@figpot/src/models/entities/penpot/page';
import { LibraryTypography } from '@figpot/src/models/entities/penpot/shapes/text';
import { Color } from '@figpot/src/models/entities/penpot/traits/color';

export type PenpotDocument = {
  name: string;
  data: {
    pages: string[];
    pagesIndex: Record<string, PenpotPage>;
    colors?: Record<string, Color>;
    typographies?: Record<string, LibraryTypography>;
    components?: Record<string, LibraryComponent>;
  };
};
