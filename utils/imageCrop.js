export const clampCropPan = (value, limit = 100) => {
  const safeLimit = Math.max(0, Number(limit) || 100);
  return Math.max(-safeLimit, Math.min(safeLimit, Number(value) || 0));
};

export const createImageCropState = ({ src, width, height }) => ({
  src,
  width: Math.max(1, Number(width) || 1),
  height: Math.max(1, Number(height) || 1),
  zoom: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startPanX: 0,
  startPanY: 0,
});

export function calculateCoverCrop({ width, height, frameWidth, frameHeight = frameWidth, zoom = 1, panX = 0, panY = 0 }) {
  const sourceWidth = Math.max(1, Number(width) || 1);
  const sourceHeight = Math.max(1, Number(height) || 1);
  const targetWidth = Math.max(1, Number(frameWidth) || 1);
  const targetHeight = Math.max(1, Number(frameHeight) || 1);
  const safeZoom = Math.max(1, Number(zoom) || 1);
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) * safeZoom;
  const displayWidth = sourceWidth * scale;
  const displayHeight = sourceHeight * scale;
  const maxShiftX = Math.max(0, (displayWidth - targetWidth) / 2);
  const maxShiftY = Math.max(0, (displayHeight - targetHeight) / 2);
  return {
    width: displayWidth,
    height: displayHeight,
    left: (targetWidth - displayWidth) / 2 + maxShiftX * clampCropPan(panX) / 100,
    top: (targetHeight - displayHeight) / 2 + maxShiftY * clampCropPan(panY) / 100,
    scale,
  };
}

export const calculateCropDrag = (crop, clientX, clientY, sensitivity = 1.8) => ({
  panX: clampCropPan((crop?.startPanX || 0) + ((Number(clientX) || 0) - (crop?.dragStartX || 0)) / sensitivity),
  panY: clampCropPan((crop?.startPanY || 0) + ((Number(clientY) || 0) - (crop?.dragStartY || 0)) / sensitivity),
});

export function drawCoverCrop(context, image, crop, frameWidth, frameHeight = frameWidth) {
  const geometry = calculateCoverCrop({
    width: image.width,
    height: image.height,
    frameWidth,
    frameHeight,
    zoom: crop?.zoom,
    panX: crop?.panX,
    panY: crop?.panY,
  });
  context.drawImage(image, geometry.left, geometry.top, geometry.width, geometry.height);
  return geometry;
}
