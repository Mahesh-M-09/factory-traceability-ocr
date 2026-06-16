import type { AppConfig } from "../types/config";

export function findMaterial(config: AppConfig, materialId: string) {
  return config.materials.find((material) => material.id === materialId);
}

export function findPart(config: AppConfig, materialId: string, partId: string) {
  return findMaterial(config, materialId)?.parts.find((part) => part.id === partId);
}

export function findOperation(config: AppConfig, materialId: string, partId: string, operationId: string) {
  return findPart(config, materialId, partId)?.operations.find((operation) => operation.id === operationId);
}
