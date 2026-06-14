import type { AppConfig, FrameTypeConfig } from "../types/config";

export function cleanSerialNumber(value: string, allowedCharacters: string) {
  const allowed = new Set(allowedCharacters.toUpperCase().split(""));
  return value
    .toUpperCase()
    .split("")
    .filter((character) => allowed.has(character))
    .join("");
}

export function isSerialValid(serialNumber: string, frameType: FrameTypeConfig) {
  return new RegExp(frameType.serialPattern).test(serialNumber);
}

export function getDefaultFrameType(config: AppConfig) {
  return config.frameTypes[0];
}
