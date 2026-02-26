/**
 * Telemetry hook — polls /api/telemetry for live system metrics.
 * All computation happens server-side; this hook is a thin fetch wrapper.
 */
import { useState, useEffect, useRef } from "react";

export interface TelemetryData {
  headerCpu: number;
  headerGpu: number;
  headerRam: number;
  headerOct: number;
  gpuUtil: number;
  gpuTemp: number;
  gpuMem: number;
  gpuPower: number;
  dbUptime: number;
  dbQps: number;
  dbStorage: number;
  dbLatency: number;
  sigSpeed: number;
  sigThroughput: number;
  sigAccuracy: number;
  cpuUtil: number;
  cpuTemp: number;
  exLatency: number;
  exUptime: number;
  exOrderRate: number;
  exFillRate: number;
  tradingInference: number;
  consensusAccuracy: number;
  latencyHistory: number[];
  throughputHistory: number[];
  currentLatency: number;
  currentThroughput: number;
  totalTasks: number;
  activeTasks: number;
}

// Fallback shown while the first fetch is in-flight
const EMPTY: TelemetryData = {
  headerCpu: 0, headerGpu: 0, headerRam: 0, headerOct: 0,
  gpuUtil: 0, gpuTemp: 0, gpuMem: 0, gpuPower: 0,
  dbUptime: 0, dbQps: 0, dbStorage: 0, dbLatency: 0,
  sigSpeed: 0, sigThroughput: 0, sigAccuracy: 0,
  cpuUtil: 0, cpuTemp: 0,
  exLatency: 0, exUptime: 0, exOrderRate: 0, exFillRate: 0,
  tradingInference: 0, consensusAccuracy: 0,
  latencyHistory: [], throughputHistory: [],
  currentLatency: 0, currentThroughput: 0,
  totalTasks: 0, activeTasks: 0,
};

export function useTelemetry(intervalMs = 2000): TelemetryData {
  const [data, setData] = useState<TelemetryData>(EMPTY);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        controller.current?.abort();
        controller.current = new AbortController();
        const res = await fetch("/api/telemetry", {
          signal: controller.current.signal,
        });
        if (res.ok && active) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Network error or abort — keep previous data
      }
    };

    // Initial fetch immediately
    poll();
    const id = setInterval(poll, intervalMs);

    return () => {
      active = false;
      controller.current?.abort();
      clearInterval(id);
    };
  }, [intervalMs]);

  return data;
}
