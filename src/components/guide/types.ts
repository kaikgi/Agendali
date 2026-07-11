export interface GuideStep {
  /** Unique within the guide, used for keys and debugging only. */
  id: string;
  title: string;
  description: string;
  /** CSS selector for the element to spotlight. Omit for a centered, non-anchored step. */
  target?: string;
  /** Preferred side to place the tooltip card relative to the target. */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Fires once when this step becomes the active step (e.g. to open a dialog). */
  onEnter?: () => void;
}
