const EXPLICIT_DISMISS_PANEL_TYPES = new Set(["plant"]);

export const canDismissPanelFromBackdrop = (panel, now = Date.now()) => (
  !EXPLICIT_DISMISS_PANEL_TYPES.has(panel?.type)
  && now >= Number(panel?.dismissReadyAt || 0)
);
