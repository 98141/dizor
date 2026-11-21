"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createConfirmedSettings } from "@/lib/confirmedSettings.mjs";
export default function useConfirmedSettings(options) {
  const [resource] = useState(() => createConfirmedSettings(options));
  const state = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  useEffect(() => { resource.load(); return resource.cancel; }, [resource]);
  return { ...state, resource };
}
