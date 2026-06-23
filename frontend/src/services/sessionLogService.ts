import type { OperationVisitLog, OperatorSessionLog } from "../types/config";

const SESSION_LOG_KEY = "factoryTraceabilitySessionLogs";
const OPERATION_VISIT_LOG_KEY = "factoryTraceabilityOperationVisitLogs";
const ACTIVE_SESSION_KEY = "factoryTraceabilityActiveSession";

export function startOperatorSession(operatorId: string) {
  const now = new Date().toISOString();
  const activeSession = {
    id: `${operatorId}-${now}`,
    operatorId,
    signedInAt: now,
    signedOutAt: ""
  };
  const logs = loadOperatorSessionLogs();
  window.localStorage.setItem(SESSION_LOG_KEY, JSON.stringify([...logs, activeSession], null, 2));
  window.sessionStorage.setItem(ACTIVE_SESSION_KEY, activeSession.id);
}

export function endOperatorSession() {
  const activeSessionId = window.sessionStorage.getItem(ACTIVE_SESSION_KEY);
  if (!activeSessionId) {
    return;
  }
  const now = new Date().toISOString();
  const logs = loadOperatorSessionLogs().map((log) => (log.id === activeSessionId ? { ...log, signedOutAt: now } : log));
  window.localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(logs, null, 2));
  window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
}

export function recordOperationVisit(input: Omit<OperationVisitLog, "id" | "exitedAt" | "seconds"> & { enteredAt: string }) {
  const exitedAt = new Date().toISOString();
  const seconds = Math.max(1, Math.round((new Date(exitedAt).getTime() - new Date(input.enteredAt).getTime()) / 1000));
  const log: OperationVisitLog = {
    ...input,
    id: `${input.operatorId}-${input.operation}-${input.enteredAt}`,
    exitedAt,
    seconds
  };
  const logs = loadOperationVisitLogs();
  window.localStorage.setItem(OPERATION_VISIT_LOG_KEY, JSON.stringify([...logs, log], null, 2));
}

export function loadOperatorSessionLogs(): OperatorSessionLog[] {
  return readArray<OperatorSessionLog>(SESSION_LOG_KEY);
}

export function loadOperationVisitLogs(): OperationVisitLog[] {
  return readArray<OperationVisitLog>(OPERATION_VISIT_LOG_KEY);
}

function readArray<T>(key: string): T[] {
  const saved = window.localStorage.getItem(key);
  if (!saved) {
    return [];
  }
  try {
    const parsed = JSON.parse(saved) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
