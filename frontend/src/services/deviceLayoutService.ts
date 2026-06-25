export type DeviceLayoutMode = "iphone11" | "iphone11Landscape" | "ipad" | "custom" | "auto";

export interface DeviceLayout {
  mode: DeviceLayoutMode;
  width: number;
  minHeight: number;
}

const DEVICE_LAYOUT_KEY = "factoryTraceabilityDeviceLayout";

export const DEVICE_LAYOUT_PRESETS: Record<DeviceLayoutMode, DeviceLayout & { label: string }> = {
  iphone11: { mode: "iphone11", label: "iPhone 11", width: 414, minHeight: 896 },
  iphone11Landscape: { mode: "iphone11Landscape", label: "iPhone 11 landscape", width: 896, minHeight: 414 },
  ipad: { mode: "ipad", label: "iPad", width: 1024, minHeight: 768 },
  custom: { mode: "custom", label: "Custom", width: 414, minHeight: 896 },
  auto: { mode: "auto", label: "Auto width", width: 0, minHeight: 0 }
};

export function loadDeviceLayout(): DeviceLayout {
  const saved = window.localStorage.getItem(DEVICE_LAYOUT_KEY);
  if (!saved) {
    return DEVICE_LAYOUT_PRESETS.iphone11;
  }

  try {
    const parsed = JSON.parse(saved) as DeviceLayout;
    if (parsed.mode === "auto") {
      return DEVICE_LAYOUT_PRESETS.auto;
    }
    return {
      mode: parsed.mode in DEVICE_LAYOUT_PRESETS ? parsed.mode : "custom",
      width: Math.max(320, Number(parsed.width) || DEVICE_LAYOUT_PRESETS.iphone11.width),
      minHeight: Math.max(360, Number(parsed.minHeight) || DEVICE_LAYOUT_PRESETS.iphone11.minHeight)
    };
  } catch {
    return DEVICE_LAYOUT_PRESETS.iphone11;
  }
}

export function saveDeviceLayout(layout: DeviceLayout) {
  window.localStorage.setItem(DEVICE_LAYOUT_KEY, JSON.stringify(layout));
}
