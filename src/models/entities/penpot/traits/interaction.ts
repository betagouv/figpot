import { Animation } from '@figpot/src/models/entities/penpot/traits/animation';
import { Point } from '@figpot/src/models/entities/penpot/traits/point';
import { Uuid } from '@figpot/src/models/entities/penpot/traits/uuid';

type EventType = 'click' | 'mouse-press' | 'mouse-over' | 'mouse-enter' | 'mouse-leave' | 'after-delay';

type OverlayPosType = 'manual' | 'center' | 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'bottom-center';

type InteractionNavigate = {
  actionType: 'navigate';
  eventType: EventType;
  destination?: Uuid;
  preserveScroll?: boolean;
  animation?: Animation;
};

type InteractionOpenOverlay = {
  actionType: 'open-overlay';
  eventType: EventType;
  overlayPosition?: Point;
  overlayPosType?: OverlayPosType;
  destination?: Uuid;
  closeClickOutside?: boolean;
  backgroundOverlay?: boolean;
  animation?: Animation;
  positionRelativeTo?: Uuid;
};

type InteractionToggleOverlay = {
  actionType: 'toggle-overlay';
  eventType: EventType;
  overlayPosition?: Point;
  overlayPosType?: OverlayPosType;
  destination?: Uuid;
  closeClickOutside?: boolean;
  backgroundOverlay?: boolean;
  animation?: Animation;
  positionRelativeTo?: Uuid;
};

type InteractionCloseOverlay = {
  actionType: 'close-overlay';
  eventType: EventType;
  destination?: Uuid;
  animation?: Animation;
  positionRelativeTo?: Uuid;
};

type InteractionPrevScreen = {
  actionType: 'prev-screen';
  eventType: EventType;
};

type InteractionOpenUrl = {
  actionType: 'open-url';
  eventType: EventType;
  url: string;
};

export type Interaction =
  | InteractionNavigate
  | InteractionOpenOverlay
  | InteractionToggleOverlay
  | InteractionCloseOverlay
  | InteractionPrevScreen
  | InteractionOpenUrl;
