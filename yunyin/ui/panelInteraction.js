export const canDismissPanelFromBackdrop = (panel, now = Date.now()) => (
  now >= Number(panel?.dismissReadyAt || 0)
);
