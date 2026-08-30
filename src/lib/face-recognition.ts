// Task 27: face recognition stub — gated by VITE_FACE_ENABLED
// All operations are no-ops until the flag is set and models are provisioned.

const ENABLED = import.meta.env['VITE_FACE_ENABLED'] === "true" || import.meta.env['VITE_FACE_ENABLED'] === "1";

export const FACE_ENABLED = ENABLED;

/** Load face-api / face-landmarks models (stub — no-op when disabled). */
export async function loadModels(): Promise<void> {
  if (!ENABLED) return;
  console.warn("[face-recognition] loadModels stub — models not provisioned");
  // Future: await faceapi.nets.ssdMobilenetv1.loadFromUri('/models'); etc.
}

/**
 * Detect a single face and return a descriptor embedding (stub).
 * Returns null when disabled or no face found.
 */
export async function detectFace(_image: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<Float32Array | null> {
  if (!ENABLED) return null;
  console.warn("[face-recognition] detectFace stub — not implemented");
  return null;
}

/**
 * Enroll a face embedding for a profile (stub).
 * Returns the serialized descriptor placeholder.
 */
export async function enrollFace(_embedding: Float32Array, _profileId: string): Promise<string | null> {
  if (!ENABLED) return null;
  console.warn("[face-recognition] enrollFace stub — not implemented");
  return null;
}

/** Distance between two descriptors (stub — returns Infinity when disabled). */
export function faceDistance(_a: Float32Array, _b: Float32Array): number {
  if (!ENABLED) return Infinity;
  return Infinity;
}
