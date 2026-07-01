import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="admin-layout">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div 
        className="content-wrapper"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          minHeight: '100vh',
          transition: 'var(--transition)',
          marginLeft: isCollapsed ? 'var(--sidebar-collapsed-w)' : 'var(--sidebar-w)',
          minWidth: 0
        }}
      >
        <TopBar />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
