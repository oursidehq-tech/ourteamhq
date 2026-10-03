import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Eye, 
  Download, 
  XCircle, 
  RefreshCw, 
  Plus, 
  Edit2, 
  Trash2, 
  Users, 
  ListChecks, 
  Layers, 
  Calendar 
} from 'lucide-react';
import { useClub } from '../context/ClubContext';
import { complianceService } from '../services/complianceService';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import MultiSelect from '../components/MultiSelect';

const DEFAULT_PRESETS = {
  coach: [
    { name: 'Working With Children Check (WWCC)', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'Valid card number and photo copy' },
    { name: 'Coaching Accreditation (Level 1/2)', type: 'Certificate', mandatory: true, expiryRequired: false, notes: 'National federation badge or certificate' },
    { name: 'CPR & First Aid Certificate', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'HLTAID009 or HLTAID011' },
    { name: 'Code of Conduct Agreement', type: 'Policy Agreement', mandatory: true, expiryRequired: false, notes: 'Signed policy acknowledgment' },
  ],
  volunteer: [
    { name: 'Working With Children Check (WWCC)', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'Verified card' },
    { name: 'National Police Clearance', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'Issued within past 12 months' },
    { name: 'Child Safeguarding Declaration', type: 'Policy Agreement', mandatory: true, expiryRequired: false, notes: 'Signed safeguarding statement' },
  ],
  player: [
    { name: 'Player Medical Clearance', type: 'Medical', mandatory: true, expiryRequired: true, notes: 'Signed by registered practitioner' },
    { name: 'Concussion Protocol Sign-off', type: 'Policy Agreement', mandatory: true, expiryRequired: false, notes: 'Player & parent acknowledgment' },
    { name: 'Emergency Contact & Consent', type: 'ID', mandatory: true, expiryRequired: false, notes: 'Verified parent/guardian info' },
  ]
};

const emptyFormState = {
  title: '',
  description: '',
  type: 'Certificate',
  expiryRequired: true,
  targetType: 'all', // 'all' or 'specific'
  targetTeamIds: [],
  targetGroupIds: [],
  targetRoles: ['Coach', 'Manager', 'Volunteer'],
  requirements: [
    { name: 'Working With Children Check (WWCC)', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'Upload current card with photo' },
    { name: 'CPR & First Aid Certificate', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'HLTAID009 or HLTAID011' }
  ]
};

const Compliance = () => {
  const { selectedClubId } = useClub();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Review document modal
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  
  // Compliance data
  const [complianceData, setComplianceData] = useState([]);
  const [complianceForms, setComplianceForms] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Form Create / Edit Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFormId, setEditingFormId] = useState(null); // null for new, id for editing
  const [formState, setFormState] = useState(emptyFormState);

  // Form View Modal
  const [viewingForm, setViewingForm] = useState(null);

  useEffect(() => {
    if (selectedClubId) {
      loadCompliance();
      loadClubEntities();
    }
  }, [selectedClubId]);

  const loadClubEntities = async () => {
    try {
      const [tSnap, gSnap] = await Promise.all([
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(collection(db, 'clubs', selectedClubId, 'groups')),
      ]);
      setTeams(tSnap.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));
      setGroups(gSnap.docs.map(d => ({ id: d.id, name: d.data().groupName || d.data().name || d.id })));
    } catch (err) {
      console.warn('Error loading club entities:', err);
    }
  };

  const loadCompliance = async () => {
    setLoading(true);
    try {
      const data = await complianceService.getStaffCompliance(selectedClubId);
      setComplianceData(data);
      const forms = await complianceService.getComplianceForms(selectedClubId);
      setComplianceForms(forms);
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

  // Open Form Create Modal
  const openCreateForm = () => {
    setEditingFormId(null);
    setFormState({
      ...emptyFormState,
      requirements: [
        { name: 'Working With Children Check (WWCC)', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'Upload current card with photo' },
        { name: 'CPR & First Aid Certificate', type: 'Certificate', mandatory: true, expiryRequired: true, notes: 'HLTAID009 or HLTAID011' }
      ]
    });
    setShowFormModal(true);
  };

  // Open Form Edit Modal
  const openEditForm = (form) => {
    setEditingFormId(form.id);
    const existingRequirements = (form.requirements && form.requirements.length > 0)
      ? form.requirements
      : [
          { 
            name: form.title || 'Required Document', 
            type: form.type || 'Certificate', 
            mandatory: true, 
            expiryRequired: !!form.expiryRequired, 
            notes: 'Verification required' 
          }
        ];

    setFormState({
      title: form.title || '',
      description: form.description || '',
      type: form.type || 'Certificate',
      expiryRequired: form.expiryRequired !== undefined ? form.expiryRequired : true,
      targetType: form.targetType || (form.targetTeamIds?.length || form.targetGroupIds?.length ? 'specific' : 'all'),
      targetTeamIds: form.targetTeamIds || [],
      targetGroupIds: form.targetGroupIds || [],
      targetRoles: form.targetRoles || ['Coach', 'Manager', 'Volunteer'],
      requirements: existingRequirements
    });
    setViewingForm(null);
    setShowFormModal(true);
  };

  // Open Form View Modal
  const openViewForm = (form) => {
    setViewingForm(form);
  };

  // Delete Form
  const handleDeleteForm = async (form) => {
    if (!window.confirm(`Are you sure you want to delete the compliance form "${form.title}"?`)) return;
    setIsUpdating(true);
    try {
      await complianceService.deleteComplianceForm(selectedClubId, form.id);
      if (viewingForm?.id === form.id) setViewingForm(null);
      loadCompliance();
    } catch (err) {
      alert('Error deleting form: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Save (Create or Update) Form
  const handleSaveForm = async () => {
    if (!formState.title.trim()) return alert('Form title is required');
    if (!formState.requirements || formState.requirements.length === 0) {
      return alert('Please include at least one requirement in the compliance list.');
    }
    for (const r of formState.requirements) {
      if (!r.name?.trim()) return alert('All requirement items in the spreadsheet must have a title.');
    }

    setIsUpdating(true);
    try {
      const payload = {
        title: formState.title.trim(),
        description: formState.description || '',
        type: formState.type || 'Certificate',
        expiryRequired: !!formState.expiryRequired,
        targetType: formState.targetType,
        targetTeamIds: formState.targetType === 'specific' ? formState.targetTeamIds : [],
        targetGroupIds: formState.targetType === 'specific' ? formState.targetGroupIds : [],
        targetRoles: formState.targetRoles || [],
        requirements: formState.requirements,
      };

      if (editingFormId) {
        await complianceService.updateComplianceForm(selectedClubId, editingFormId, payload);
        alert('Compliance form updated successfully!');
      } else {
        await complianceService.createComplianceForm(selectedClubId, payload);
        alert('Compliance form created successfully!');
      }

      setShowFormModal(false);
      setEditingFormId(null);
      loadCompliance();
    } catch (err) {
      alert('Error saving form: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Spreadsheet Row Handlers
  const addRequirementRow = () => {
    setFormState(prev => ({
      ...prev,
      requirements: [
        ...prev.requirements,
        { name: '', type: 'Certificate', mandatory: true, expiryRequired: true, notes: '' }
      ]
    }));
  };

  const updateRequirementRow = (index, field, value) => {
    setFormState(prev => {
      const updated = [...prev.requirements];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, requirements: updated };
    });
  };

  const removeRequirementRow = (index) => {
    setFormState(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const applyPresetPack = (packKey) => {
    const pack = DEFAULT_PRESETS[packKey];
    if (!pack) return;
    setFormState(prev => ({
      ...prev,
      requirements: [...prev.requirements, ...pack.map(p => ({ ...p }))]
    }));
  };

  // Helper to format linked targets
  const renderLinkedSummary = (row) => {
    if (row.targetType === 'all' || (!row.targetTeamIds?.length && !row.targetGroupIds?.length)) {
      return <span className="badge badge-success" style={{ fontSize: '11px' }}>Entire Club</span>;
    }
    const teamNames = (row.targetTeamIds || []).map(id => teams.find(t => t.id === id)?.name || 'Team').filter(Boolean);
    const groupNames = (row.targetGroupIds || []).map(id => groups.find(g => g.id === id)?.name || 'Group').filter(Boolean);
    const all = [...teamNames, ...groupNames];
    
    if (all.length === 0) return <span className="text-muted text-xs">Club-wide</span>;
    return (
      <div className="flex gap-xs" style={{ flexWrap: 'wrap', maxWidth: '240px' }}>
        {all.slice(0, 2).map((name, i) => (
          <span key={i} className="badge badge-info" style={{ fontSize: '10px', padding: '2px 6px' }}>{name}</span>
        ))}
        {all.length > 2 && (
          <span className="badge badge-default" style={{ fontSize: '10px', padding: '2px 6px' }}>+{all.length - 2} more</span>
        )}
      </div>
    );
  };

  // Table Columns
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
          {val || 'N/A'}
        </span>
      )
    }
  ];

  const formColumns = [
    { 
      header: 'Form Title', 
      accessor: 'title', 
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{val}</div>
          {row.description && <div className="text-xs text-muted" style={{ maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.description}</div>}
        </div>
      ) 
    },
    { 
      header: 'Linked To', 
      accessor: 'targetType', 
      render: (_, row) => renderLinkedSummary(row) 
    },
    { 
      header: 'Checklist / Requirements', 
      accessor: 'requirements', 
      render: (val) => {
        const count = val?.length || 1;
        return (
          <span className="badge badge-default" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ListChecks size={12} /> {count} {count === 1 ? 'item' : 'items'}
          </span>
        );
      } 
    },
    { header: 'Primary Doc', accessor: 'type', render: (val) => <span className="badge badge-info">{val}</span> },
    { header: 'Requires Expiry', accessor: 'expiryRequired', render: (val) => val ? 'Yes' : 'No' },
    { header: 'Created', accessor: 'createdAt', render: (val) => val?.toDate?.().toLocaleDateString() || '—' },
  ];

  const actions = [
    { 
      label: 'Review', 
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

  const formActions = [
    {
      label: 'View Details',
      icon: <Eye size={16} />,
      onClick: (row) => openViewForm(row)
    },
    {
      label: 'Edit Form',
      icon: <Edit2 size={16} />,
      onClick: (row) => openEditForm(row)
    },
    {
      label: 'Delete Form',
      icon: <Trash2 size={16} />,
      variant: 'danger',
      onClick: (row) => handleDeleteForm(row)
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
          <button className="btn btn-primary" onClick={openCreateForm}>
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
          <button className={`tab ${activeTab === 'forms' ? 'active' : ''}`} onClick={() => setActiveTab('forms')}>
            <FileText size={16} />
            Custom Forms ({complianceForms.length})
          </button>
        </div>
      </div>

      {activeTab === 'forms' ? (
        <DataTable 
          title="Custom Compliance Forms"
          columns={formColumns}
          data={complianceForms}
          actions={formActions}
          onRowClick={(row) => openViewForm(row)}
          loading={loading}
          emptyMessage="No custom compliance forms created yet. Click 'Create Form' to build one."
        />
      ) : (
        <DataTable 
          title="Staff Documentation"
          columns={columns}
          data={filteredData}
          actions={actions}
          onRowClick={(row) => { setSelectedDoc(row); setShowModal(true); }}
          loading={loading}
          emptyMessage="No compliance records found for this filter."
        />
      )}

      {/* Document Review Modal */}
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
              <p><strong>Expiry:</strong> {selectedDoc.expiry || 'N/A'}</p>
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

      {/* Form Details / View Modal */}
      <Modal 
        title="Compliance Form Details"
        open={!!viewingForm}
        onClose={() => setViewingForm(null)}
        extraWide={true}
      >
        {viewingForm && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', margin: '0 0 6px 0' }}>{viewingForm.title}</h3>
                <p className="text-muted" style={{ margin: 0 }}>{viewingForm.description || 'Club-wide compliance requirement package'}</p>
              </div>
              <div className="flex gap-sm">
                <span className="badge badge-info">{viewingForm.type || 'Certificate'}</span>
                {viewingForm.expiryRequired && <span className="badge badge-warning">Requires Expiry</span>}
              </div>
            </div>

            {/* Target Scope */}
            <div className="card mb-md" style={{ background: 'var(--bg)', padding: '16px' }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Target Assignment / Scope
              </h5>
              <div className="flex gap-md" style={{ flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>Target Scope: </strong>
                  {viewingForm.targetType === 'all' || (!viewingForm.targetTeamIds?.length && !viewingForm.targetGroupIds?.length) ? (
                    <span className="badge badge-success">Entire Club</span>
                  ) : (
                    <span className="badge badge-info">Specific Teams & Groups</span>
                  )}
                </div>
                {viewingForm.targetTeamIds?.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '13px' }}>Teams: </strong>
                    {viewingForm.targetTeamIds.map(id => (
                      <span key={id} className="badge badge-default" style={{ marginRight: '4px' }}>
                        {teams.find(t => t.id === id)?.name || id}
                      </span>
                    ))}
                  </div>
                )}
                {viewingForm.targetGroupIds?.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '13px' }}>Groups: </strong>
                    {viewingForm.targetGroupIds.map(id => (
                      <span key={id} className="badge badge-default" style={{ marginRight: '4px' }}>
                        {groups.find(g => g.id === id)?.name || id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Requirements Spreadsheet Table */}
            <div className="mb-md">
              <div className="flex justify-between items-center mb-sm">
                <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                  Compliance Checklist Requirements (Spreadsheet)
                </h5>
                <span className="text-muted text-xs">
                  {viewingForm.requirements?.length || 1} required item(s)
                </span>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Requirement Item</th>
                      <th>Type</th>
                      <th>Mandatory</th>
                      <th>Expiry</th>
                      <th>Instructions / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingForm.requirements && viewingForm.requirements.length > 0 ? viewingForm.requirements : [
                      { name: viewingForm.title, type: viewingForm.type || 'Certificate', mandatory: true, expiryRequired: !!viewingForm.expiryRequired, notes: 'Standard club submission' }
                    ]).map((req, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                        <td><strong>{req.name}</strong></td>
                        <td><span className="badge badge-info" style={{ fontSize: '11px' }}>{req.type}</span></td>
                        <td>{req.mandatory ? <span className="badge badge-danger">Required</span> : <span className="badge badge-default">Optional</span>}</td>
                        <td>{req.expiryRequired ? <span className="badge badge-warning">Expiry Date</span> : <span className="text-muted">No</span>}</td>
                        <td className="text-muted text-sm">{req.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions mt-lg">
              <button className="btn btn-outline danger" onClick={() => handleDeleteForm(viewingForm)} disabled={isUpdating}>
                <Trash2 size={16} /> Delete Form
              </button>
              <div className="flex gap-sm">
                <button className="btn btn-outline" onClick={() => setViewingForm(null)}>Close</button>
                <button className="btn btn-primary" onClick={() => openEditForm(viewingForm)}>
                  <Edit2 size={16} /> Edit Form
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create / Edit Form Modal with Spreadsheet Matrix */}
      <Modal 
        title={editingFormId ? "Edit Compliance Form" : "Create Custom Compliance Form"}
        open={showFormModal}
        onClose={() => setShowFormModal(false)}
        extraWide={true}
      >
        <div>
          {/* Top Form Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Form Title <span className="text-danger">*</span></label>
              <input 
                className="form-control" 
                placeholder="e.g. Coach Accreditation & Child Safety Clearance" 
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Primary Document Type</label>
              <select 
                className="form-control"
                value={formState.type}
                onChange={(e) => setFormState({ ...formState, type: e.target.value })}
              >
                <option value="Certificate">Certificate</option>
                <option value="ID">Identification (ID)</option>
                <option value="Policy Agreement">Policy Agreement</option>
                <option value="Medical">Medical Document</option>
                <option value="Police Clearance">Police Clearance</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description / Club Instructions</label>
            <input 
              className="form-control"
              placeholder="e.g. Required for all registered coaches and team managers before round 1"
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
            />
          </div>

          {/* Linking to Teams and Groups */}
          <div className="card mb-md" style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-sm">
              <label style={{ margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} className="text-primary" /> Target Assignment (Link to Teams or Groups)
              </label>
              <div style={{ display: 'flex', background: '#e2e8f0', padding: 3, borderRadius: 8, gap: 4 }}>
                <button 
                  type="button"
                  style={{
                    border: 'none',
                    background: formState.targetType === 'all' ? 'var(--primary)' : 'transparent',
                    color: formState.targetType === 'all' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: 12,
                    padding: '5px 12px',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                  onClick={() => setFormState({ ...formState, targetType: 'all' })}
                >
                  Entire Club
                </button>
                <button 
                  type="button"
                  style={{
                    border: 'none',
                    background: formState.targetType === 'specific' ? 'var(--primary)' : 'transparent',
                    color: formState.targetType === 'specific' ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: 12,
                    padding: '5px 12px',
                    borderRadius: 6,
                    cursor: 'pointer'
                  }}
                  onClick={() => setFormState({ ...formState, targetType: 'specific' })}
                >
                  Specific Teams / Groups
                </button>
              </div>
            </div>

            {formState.targetType === 'specific' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Select Teams
                  </label>
                  <MultiSelect
                    options={teams.map(t => ({ id: t.id, name: t.name }))}
                    selectedValues={formState.targetTeamIds}
                    onChange={(vals) => setFormState({ ...formState, targetTeamIds: vals })}
                    placeholder="Search and select teams..."
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Select Groups
                  </label>
                  <MultiSelect
                    options={groups.map(g => ({ id: g.id, name: g.name }))}
                    selectedValues={formState.targetGroupIds}
                    onChange={(vals) => setFormState({ ...formState, targetGroupIds: vals })}
                    placeholder="Search and select groups..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Spreadsheet Checklist Builder */}
          <div className="mb-md">
            <div className="flex justify-between items-center mb-sm">
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ListChecks size={18} className="text-primary" />
                  Compliance Requirements Spreadsheet (List of Things Needed)
                </h4>
                <p className="text-muted text-xs" style={{ margin: '2px 0 0 0' }}>
                  List all documents, certificates, and check items that staff, coaches, or players must submit.
                </p>
              </div>
              <div className="flex gap-xs" style={{ alignItems: 'center' }}>
                <span className="text-xs text-muted" style={{ marginRight: '4px' }}>Quick Presets:</span>
                <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '8px' }} onClick={() => applyPresetPack('coach')}>
                  + Coach Pack
                </button>
                <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '8px' }} onClick={() => applyPresetPack('volunteer')}>
                  + Volunteer Pack
                </button>
                <button type="button" className="btn btn-outline btn-sm" style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '8px' }} onClick={() => applyPresetPack('player')}>
                  + Player Pack
                </button>
              </div>
            </div>

            {/* Spreadsheet Table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflowX: 'auto', background: '#fff' }}>
              <table className="compliance-matrix-table" style={{ margin: 0, minWidth: '700px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30px' }}>#</th>
                    <th style={{ minWidth: '220px' }}>Requirement / Checklist Item</th>
                    <th style={{ width: '150px' }}>Type</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Mandatory</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Needs Expiry</th>
                    <th style={{ minWidth: '180px' }}>Notes / Instructions</th>
                    <th style={{ width: '50px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {formState.requirements.map((row, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {index + 1}
                      </td>
                      <td>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="e.g. Working With Children Check (WWCC)"
                          value={row.name}
                          onChange={(e) => updateRequirementRow(index, 'name', e.target.value)}
                          required
                        />
                      </td>
                      <td>
                        <select 
                          className="form-control"
                          value={row.type}
                          onChange={(e) => updateRequirementRow(index, 'type', e.target.value)}
                        >
                          <option value="Certificate">Certificate</option>
                          <option value="Police Clearance">Police Clearance</option>
                          <option value="ID">Identification (ID)</option>
                          <option value="Medical">Medical Clearance</option>
                          <option value="Policy Agreement">Policy Agreement</option>
                          <option value="Course Completion">Course</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={row.mandatory}
                          onChange={(e) => updateRequirementRow(index, 'mandatory', e.target.checked)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={row.expiryRequired}
                          onChange={(e) => updateRequirementRow(index, 'expiryRequired', e.target.checked)}
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Instructions for staff or player..."
                          value={row.notes || ''}
                          onChange={(e) => updateRequirementRow(index, 'notes', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          className="btn-icon danger" 
                          onClick={() => removeRequirementRow(index)}
                          title="Remove row"
                          disabled={formState.requirements.length <= 1}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '12px' }}>
              <button 
                type="button" 
                className="btn btn-outline btn-sm" 
                onClick={addRequirementRow}
              >
                <Plus size={14} /> Add Requirement Item
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions" style={{ marginTop: '24px' }}>
            <button className="btn btn-outline" onClick={() => setShowFormModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveForm} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : editingFormId ? 'Save Changes' : 'Create Compliance Form'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Compliance;
