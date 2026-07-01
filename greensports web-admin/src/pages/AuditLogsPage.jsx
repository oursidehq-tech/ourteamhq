import React, { useState } from 'react';
import { FileText, Clock, User, Shield, Info } from 'lucide-react';
import DataTable from '../components/DataTable';

const AuditLogsPage = () => {
  const [loading, setLoading] = useState(false);

  const logs = [
    { id: 1, user: 'Admin User', action: 'Score Update', target: 'U14 vs U15 Fixture', timestamp: '2024-05-14 10:30', ip: '192.168.1.1' },
    { id: 2, user: 'Manager Smith', action: 'Member Edit', target: 'John Doe Profile', timestamp: '2024-05-14 09:15', ip: '192.168.1.5' },
    { id: 3, user: 'Admin User', action: 'League Created', target: 'Summer League 2024', timestamp: '2024-05-13 16:45', ip: '192.168.1.1' },
    { id: 4, user: 'System', action: 'Auto Backup', target: 'Firestore Database', timestamp: '2024-05-13 00:00', ip: 'internal' },
  ];

  const columns = [
    { 
      header: 'Timestamp', 
      accessor: 'timestamp',
      render: (val) => (
        <div className="flex-center gap-sm text-muted">
          <Clock size={14} />
          <span>{val}</span>
        </div>
      )
    },
    { 
      header: 'User', 
      accessor: 'user',
      render: (val) => (
        <div className="flex-center gap-sm">
          <User size={14} className="text-primary" />
          <span style={{ fontWeight: 600 }}>{val}</span>
        </div>
      )
    },
    { 
      header: 'Action', 
      accessor: 'action',
      render: (val) => <span className="badge badge-info">{val}</span>
    },
    { header: 'Target', accessor: 'target' },
    { header: 'IP Address', accessor: 'ip', render: (val) => <code style={{ fontSize: '12px' }}>{val}</code> }
  ];

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p>Track all administrative actions, score changes, and member edits.</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-outline">
            <Shield size={18} />
            <span>Security Settings</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', background: 'var(--primary-light)', borderColor: 'var(--primary)', borderStyle: 'dashed' }}>
        <div className="flex gap-md">
          <Info className="text-primary" />
          <div>
            <h4 style={{ color: 'var(--primary-dark)' }}>Database Backups</h4>
            <p className="text-sm">Automated Firestore backups are scheduled daily at 00:00 UTC. Last backup: <b>Successful (8 hours ago)</b>.</p>
          </div>
        </div>
      </div>

      <DataTable 
        title="System Activity"
        columns={columns}
        data={logs}
        loading={loading}
        searchPlaceholder="Filter by user or action..."
      />
    </div>
  );
};

export default AuditLogsPage;
