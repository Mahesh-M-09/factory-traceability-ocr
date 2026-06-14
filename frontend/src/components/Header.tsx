import { LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";

interface HeaderProps {
  operatorId: string;
  onLogout: () => void;
}

export function Header({ operatorId, onLogout }: HeaderProps) {
  return (
    <header className="app-header">
      <Link className="brand" to={operatorId ? "/operations" : "/"}>
        Traceability OCR
      </Link>
      <nav className="header-actions">
        {operatorId && <span className="operator-pill">ID {operatorId}</span>}
        <Link className="icon-button" to="/admin" title="Admin configuration" aria-label="Admin configuration">
          <Settings size={22} />
        </Link>
        {operatorId && (
          <button className="icon-button" onClick={onLogout} title="Log out" aria-label="Log out">
            <LogOut size={22} />
          </button>
        )}
      </nav>
    </header>
  );
}
