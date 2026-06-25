import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Header } from "./components/Header";
import { AdminConfigPage } from "./pages/AdminConfigPage";
import { AdminConnectionsPage } from "./pages/AdminConnectionsPage";
import { CapturePage } from "./pages/CapturePage";
import { LoginPage } from "./pages/LoginPage";
import { MaterialSelectionPage } from "./pages/MaterialSelectionPage";
import { OperationFormPage } from "./pages/OperationFormPage";
import { OperationSelectionPage } from "./pages/OperationSelectionPage";
import { OcrTestPage } from "./pages/OcrTestPage";
import { PartSelectionPage } from "./pages/PartSelectionPage";
import { ProductionDashboardPage } from "./pages/ProductionDashboardPage";
import { RecordsPage } from "./pages/RecordsPage";
import { SavePage } from "./pages/SavePage";
import { SearchPage } from "./pages/SearchPage";
import { TargetsPage } from "./pages/TargetsPage";
import { loadAppConfig } from "./services/configService";
import { clearAdminUser, getStoredAdminUser } from "./services/adminAuthService";
import { getStoredOperatorId } from "./services/operatorService";
import { endOperatorSession } from "./services/sessionLogService";
import { findOperation } from "./services/selection";
import type { AppConfig, CaptureState, OperationRecord } from "./types/config";

export interface AppContextValue {
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
  operatorId: string;
  setOperatorId: (operatorId: string) => void;
  adminUser: string;
  setAdminUser: (adminUser: string) => void;
  selectedMaterialId: string;
  setSelectedMaterialId: (materialId: string) => void;
  selectedPartId: string;
  setSelectedPartId: (partId: string) => void;
  selectedOperationId: string;
  setSelectedOperationId: (operationId: string) => void;
  capture: CaptureState | null;
  setCapture: (capture: CaptureState | null) => void;
  pendingRecord: OperationRecord | null;
  setPendingRecord: (record: OperationRecord | null) => void;
}

export const AppContext = React.createContext<AppContextValue | null>(null);

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loadError, setLoadError] = useState("");
  const [operatorId, setOperatorId] = useState(getStoredOperatorId());
  const [adminUser, setAdminUser] = useState(getStoredAdminUser());
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [pendingRecord, setPendingRecord] = useState<OperationRecord | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadAppConfig().then(setConfig).catch((error: Error) => setLoadError(error.message));
  }, []);

  const contextValue = useMemo(() => {
    if (!config) {
      return null;
    }

    return {
      config,
      setConfig,
      operatorId,
      setOperatorId,
      adminUser,
      setAdminUser,
      selectedMaterialId,
      setSelectedMaterialId,
      selectedPartId,
      setSelectedPartId,
      selectedOperationId,
      setSelectedOperationId,
      capture,
      setCapture,
      pendingRecord,
      setPendingRecord
    };
  }, [adminUser, capture, config, operatorId, pendingRecord, selectedMaterialId, selectedOperationId, selectedPartId]);

  if (loadError) {
    return <main className="center-screen error-panel">{loadError}</main>;
  }

  if (!contextValue) {
    return <main className="center-screen">Loading configuration...</main>;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Header
        operatorId={operatorId}
        adminUser={adminUser}
        onLogout={() => {
          endOperatorSession();
          clearAdminUser();
          sessionStorage.clear();
          setOperatorId("");
          setAdminUser("");
          setSelectedMaterialId("");
          setSelectedPartId("");
          setSelectedOperationId("");
          setCapture(null);
          setPendingRecord(null);
          navigate("/");
        }}
      />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/materials" element={operatorId ? <MaterialSelectionPage /> : <Navigate to="/" />} />
        <Route path="/parts" element={operatorId && selectedMaterialId ? <PartSelectionPage /> : <Navigate to="/materials" />} />
        <Route
          path="/operations"
          element={operatorId && selectedMaterialId && selectedPartId ? <OperationSelectionPage /> : <Navigate to="/parts" />}
        />
        <Route path="/capture" element={operatorId && selectedOperationId ? <CapturePage /> : <Navigate to="/operations" />} />
        <Route
          path="/form"
          element={
            operatorId &&
            selectedOperationId &&
            (capture ||
              findOperation(contextValue.config, selectedMaterialId, selectedPartId, selectedOperationId)?.captureMode === "none") ? (
              <OperationFormPage />
            ) : (
              <Navigate to="/operations" />
            )
          }
        />
        <Route path="/save" element={operatorId && pendingRecord ? <SavePage /> : <Navigate to="/form" />} />
        <Route path="/search" element={operatorId ? <SearchPage /> : <Navigate to="/" />} />
        <Route path="/records" element={operatorId || adminUser ? <RecordsPage /> : <Navigate to="/" />} />
        <Route path="/dashboard" element={operatorId || adminUser ? <ProductionDashboardPage /> : <Navigate to="/" />} />
        <Route path="/dashboard/tv" element={<ProductionDashboardPage />} />
        <Route path="/admin" element={<AdminConfigPage />} />
        <Route path="/admin/connections" element={<AdminConnectionsPage />} />
        <Route path="/admin/ocr-test" element={adminUser ? <OcrTestPage /> : <Navigate to="/admin" />} />
        <Route path="/targets" element={adminUser ? <TargetsPage /> : <Navigate to="/admin" />} />
      </Routes>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error("App context is not ready.");
  }
  return context;
}

export default App;
