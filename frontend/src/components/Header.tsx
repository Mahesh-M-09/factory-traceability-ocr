import { Database, LogOut, Search, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  operatorId: string;
  adminUser: string;
  onLogout: () => void;
}

export function Header({ operatorId, adminUser, onLogout }: HeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="app-header">
      <Link className="brand" to={operatorId ? "/materials" : adminUser ? "/admin" : "/"}>
        Traceability OCR
      </Link>
      <nav className="header-actions">
        <span className="clock-pill">
          {now.toLocaleDateString()} {now.toLocaleTimeString()}
        </span>
        {operatorId && <span className="operator-pill">ID {operatorId}</span>}
        {adminUser && !operatorId && <span className="operator-pill">ADMIN</span>}
        {operatorId && (
          <Link className="icon-button" to="/search" title="Search serial" aria-label="Search serial">
            <Search size={22} />
          </Link>
        )}
        {(operatorId || adminUser) && (
          <Link className="icon-button" to="/records" title="Demo database" aria-label="Demo database">
            <Database size={22} />
          </Link>
        )}
        <Link className="icon-button" to="/admin" title="Admin configuration" aria-label="Admin configuration">
          <Settings size={22} />
        </Link>
        {(operatorId || adminUser) && (
          <button className="icon-button" onClick={onLogout} title="Log out" aria-label="Log out">
            <LogOut size={22} />
          </button>
        )}
      </nav>
    </header>
  );
}
