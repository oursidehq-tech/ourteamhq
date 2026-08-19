import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ShieldCheck, FileText, AlertCircle, CheckCircle, Clock, Eye, Download, XCircle, RefreshCw, Plus } from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { complianceService } from '../services/complianceService';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';

const Compliance = () => {
  const { selectedClubId } = useClub();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [complianceData, setComplianceData] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', type: 'Certificate', expiryRequired: true });

  const handleCreateForm = async () => {
    if (!newForm.title.trim()) return alert('Form title is required');
    setIsUpdating(true);
    try {
      await addDoc(collection(db, 'clubs', selectedClubId, 'complianceForms'), {
        title: newForm.title,
        type: newForm.type,
        expiryRequired: newForm.expiryRequired,
        createdAt: serverTimestamp(),
      });
      setShowFormModal(false);
      setNewForm({ title: '', type: 'Certificate', expiryRequired: true });
      alert('Compliance form created successfully!');
    } catch (err) {
      alert('Error creating form: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (selectedClubId) {
      loadCompliance();
    }
  }, [selectedClubId]);

  const loadCompliance = async () => {
    setLoading(true);
    try {
      const data = await complianceService.getStaffCompliance(selectedClubId);
      setComplianceData(data);
    } catch (error) {
      console.error('Error loading compliance:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = complianceData.filter(item => {
    if (activeTab === 'pending') return item.status === 'Pending';
    if (activeTab === 'approved') return item.status === 'Approved';
    if (activeTab === 'expired') return item.status === 'Expired';
    return true;
  });

  const handleStatusChange = async (id, newStatus, notes = '') => {
    setIsUpdating(true);
    try {
      await complianceService.updateComplianceStatus(selectedClubId, id, newStatus, notes);
      setShowModal(false);
      loadCompliance();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const columns = [
    { 
      header: 'Staff Member', 
      accessor: 'name',
      render: (val, row) => (
        <div className="flex-center gap-md">
          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
            {val ? val.charAt(0) : '?'}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{val}</div>
            <div className="text-muted text-sm">{row.role}</div>
          </div>
        </div>
      )
    },
    { 
      header: 'Document Type', 
      accessor: 'document',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{val}</div>
          <div className="badge badge-info mt-sm" style={{ fontSize: '10px', padding: '2px 6px' }}>{row.type}</div>
        </div>
      )
    },
    { 
      header: 'Status', 
      accessor: 'status',
      render: (val) => {
        const variants = {
          'Approved': 'badge-success',
          'Pending': 'badge-warning',
          'Expired': 'badge-danger',
          'Rejected': 'badge-danger'
        };
        return <span className={`badge ${variants[val] || 'badge-default'}`}>{val}</span>;
      }
    },
    { header: 'Submitted', accessor: 'submittedAt', render: (val) => val?.toDate?.().toLocaleDateString() || 'N/A' },
    { 
      header: 'Expiry Date', 
      accessor: 'expiry',
      render: (val, row) => (
        <span className={row.status === 'Expired' ? 'text-danger font-bold' : ''}>
          {val}
        </span>
      )
    }
  ];

  const actions = [
    { 
      label: 'View', 
      icon: <Eye size={16} />, 
      onClick: (row) => { setSelectedDoc(row); setShowModal(true); } 
    },
    { 
      label: 'Approve', 
      icon: <CheckCircle size={16} />, 
      onClick: (row) => handleStatusChange(row.id, 'Approved'),
      hidden: (row) => row.status !== 'Pending'
    }
  ];

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <div>
          <h1>Compliance & Safety</h1>
          <p>Review and approve coach accreditations, manager compliance, and safety requirements.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={loadCompliance}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-outline">
            <Download size={18} />
            <span>Export Report</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowFormModal(true)}>
            <Plus size={18} />
            <span>Create Form</span>
          </button>
        </div>
      </div>

      <div className="stats-marquee">
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{complianceData.filter(d => d.status === 'Approved').length}</h3>
            <p>Certified Staff</p>
          </div>
        </div>
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{complianceData.filter(d => d.status === 'Pending').length}</h3>
            <p>Pending Reviews</p>
          </div>
        </div>
        <div className="stats-marquee-card">
          <div className="sm-card-top">
            <div className="sm-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="sm-card-body">
            <h3>{complianceData.filter(d => d.status === 'Expired').length}</h3>
            <p>Expired Certificates</p>
          </div>
        </div>
      </div>

      <div className="tabs-container mb-md">
        <div className="tabs">
          <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            <Clock size={16} />
            Pending Approval
          </button>
          <button className={`tab ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>
            <CheckCircle size={16} />
            Approved
          </button>
          <button className={`tab ${activeTab === 'expired' ? 'active' : ''}`} onClick={() => setActiveTab('expired')}>
            <AlertCircle size={16} />
            Expired
          </button>
        </div>
      </div>

      <DataTable 
        title="Staff Documentation"
        columns={columns}
        data={filteredData}
        actions={actions}
        loading={loading}
      />

      <Modal 
        title="Document Review" 
        open={showModal}
        onClose={() => setShowModal(false)}
      >
        {selectedDoc && (
          <div className="document-review">
            <div className="detail-card mb-md">
              <h5>Staff Details</h5>
              <p><strong>Name:</strong> {selectedDoc.name}</p>
              <p><strong>Role:</strong> {selectedDoc.role}</p>
            </div>
            <div className="detail-card mb-md">
              <h5>Document Information</h5>
              <p><strong>Title:</strong> {selectedDoc.document}</p>
              <p><strong>Type:</strong> {selectedDoc.type}</p>
              <p><strong>Expiry:</strong> {selectedDoc.expiry}</p>
            </div>
            
            <div className="image-upload-zone" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {selectedDoc.fileUrl ? (
                <img src={selectedDoc.fileUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div className="text-center">
                  <FileText size={48} className="text-muted mb-sm" />
                  <p className="text-sm">No Preview Available</p>
                </div>
              )}
            </div>

            <div className="form-group mt-md">
              <label>Review Notes (Optional)</label>
              <textarea id="reviewNotes" className="form-control" placeholder="Add any feedback for the staff member..."></textarea>
            </div>

            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button 
                className="btn btn-danger" 
                disabled={isUpdating}
                onClick={() => handleStatusChange(selectedDoc.id, 'Rejected', document.getElementById('reviewNotes').value)}
              >
                Reject
              </button>
              <button 
                className="btn btn-primary" 
                disabled={isUpdating}
                onClick={() => handleStatusChange(selectedDoc.id, 'Approved', document.getElementById('reviewNotes').value)}
              >
                {isUpdating ? 'Updating...' : 'Approve Document'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal 
        title="Create Custom Compliance Form"
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
      >
        <div className="form-group">
          <label>Form Title</label>
          <input 
            className="form-control" 
            placeholder="e.g. Working with Children Check" 
            value={newForm.title}
            onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>Document Type</label>
          <select 
            className="form-control"
            value={newForm.type}
            onChange={(e) => setNewForm({ ...newForm, type: e.target.value })}
          >
            <option value="Certificate">Certificate</option>
            <option value="ID">Identification (ID)</option>
            <option value="Policy Agreement">Policy Agreement</option>
            <option value="Medical">Medical Document</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          <input 
            type="checkbox" 
            checked={newForm.expiryRequired}
            onChange={(e) => setNewForm({ ...newForm, expiryRequired: e.target.checked })}
          />
          <label style={{ margin: 0 }}>Requires Expiry Date</label>
        </div>
        <div className="form-actions" style={{ marginTop: '24px' }}>
          <button className="btn btn-outline" onClick={() => setShowFormModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreateForm} disabled={isUpdating}>
            {isUpdating ? 'Saving...' : 'Create Form'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Compliance;
