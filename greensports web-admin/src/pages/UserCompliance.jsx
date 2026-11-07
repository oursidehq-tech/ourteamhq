import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { complianceService } from '../services/complianceService';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import {
  ShieldCheck, FileText, CheckCircle, Clock, AlertCircle, Upload,
  Users, Layers, RefreshCw, Calendar, XCircle
} from 'lucide-react';

const STATUS_META = {
  Approved: { badge: 'badge-success', color: '#10b981', icon: CheckCircle, label: 'Approved' },
  Pending: { badge: 'badge-warning', color: '#f59e0b', icon: Clock, label: 'Pending Review' },
  Expired: { badge: 'badge-danger', color: '#ef4444', icon: AlertCircle, label: 'Expired' },
  Rejected: { badge: 'badge-danger', color: '#ef4444', icon: XCircle, label: 'Rejected' },
};

export default function UserCompliance() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);

  // Active submit modal
  const [activeReq, setActiveReq] = useState(null); // { form, req }
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!selectedClubId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [f, subs, tSnap, gSnap, mSnap] = await Promise.all([
        complianceService.getComplianceForms(selectedClubId),
        complianceService.getUserSubmissions(selectedClubId, user?.uid),
        getDocs(collection(db, 'clubs', selectedClubId, 'teams')),
        getDocs(collection(db, 'clubs', selectedClubId, 'groups')),
        getDocs(collection(db, 'clubs', selectedClubId, 'members')),
      ]);
      setForms(f);
      setSubmissions(subs);
      setTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setMembers(mSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error loading compliance portal:', err);
    }
    setLoading(false);
  }, [selectedClubId, user?.uid]);

  useEffect(() => { load(); }, [load]);

  // Locate this user's member record in the club
  const clubMemberRecord = useMemo(() => {
    if (!user) return null;
    const emailLower = user.email?.toLowerCase().trim();
    return members.find(m =>
      m.id === user.uid ||
      m.uid === user.uid ||
      m.userId === user.uid ||
      (m.email && m.email.toLowerCase().trim() === emailLower)
    );
  }, [members, user]);

  // Roles held by this user in the club
  const myRoles = useMemo(() => {
    const set = new Set();
    (clubMemberRecord?.roles || []).forEach(r => set.add(r));
    if (clubMemberRecord?.role) set.add(clubMemberRecord.role);
    const membership = profile?.clubMemberships?.find(m => m.clubId === selectedClubId);
    if (membership) {
      (membership.roles || []).forEach(r => set.add(r));
      if (membership.role) set.add(membership.role);
    }
    return [...set].filter(Boolean);
  }, [clubMemberRecord, profile, selectedClubId]);

  // Teams & groups this user belongs to
  const myTeamIds = useMemo(() => {
    const set = new Set(clubMemberRecord?.teamIds || []);
    teams.forEach(t => {
      if (t.memberIds?.includes(user?.uid)) set.add(t.id);
      if (clubMemberRecord && t.memberIds?.includes(clubMemberRecord.id)) set.add(t.id);
    });
    return [...set];
  }, [clubMemberRecord, teams, user]);

  const myGroupIds = useMemo(() => {
    const set = new Set(clubMemberRecord?.groupIds || []);
    groups.forEach(g => {
      if (g.memberIds?.includes(user?.uid)) set.add(g.id);
      if (clubMemberRecord && g.memberIds?.includes(clubMemberRecord.id)) set.add(g.id);
      if (g.memberIds?.includes(clubMemberRecord?.email)) set.add(g.id);
    });
    return [...set];
  }, [clubMemberRecord, groups, user]);

  // Forms that apply to this member (inclusive match on club/team/group/role)
  const applicableForms = useMemo(() => {
    return forms.filter(form => {
      if (form.targetType === 'all') return true;
      const teamMatch = (form.targetTeamIds || []).some(id => myTeamIds.includes(id));
      const groupMatch = (form.targetGroupIds || []).some(id => myGroupIds.includes(id));
      const roleMatch = (form.targetRoles || []).some(r => myRoles.includes(r));
      const noScope = !form.targetTeamIds?.length && !form.targetGroupIds?.length;
      return teamMatch || groupMatch || roleMatch || noScope;
    });
  }, [forms, myTeamIds, myGroupIds, myRoles]);

  // Find an existing submission for a specific requirement
  const submissionFor = (formId, reqName) =>
    submissions.find(s =>
      s.formId === formId &&
      (s.document === reqName || s.requirementName === reqName)
    );

  const openSubmit = (form, req) => {
    setActiveReq({ form, req });
    setUploadedUrl('');
    setExpiryDate('');
  };

  const closeSubmit = () => {
    setActiveReq(null);
    setUploadedUrl('');
    setExpiryDate('');
  };

  const handleSubmit = async () => {
    if (!activeReq) return;
    if (!uploadedUrl) return alert('Please upload your document before submitting.');
    const { form, req } = activeReq;
    if (req.expiryRequired && !expiryDate) return alert('Please provide the document expiry date.');

    setSaving(true);
    try {
      await complianceService.submitComplianceDocument(selectedClubId, {
        uid: user?.uid || '',
        name: profile?.displayName || clubMemberRecord?.name || 'Club Member',
        email: user?.email || clubMemberRecord?.email || '',
        role: myRoles.join(', ') || 'Member',
        formId: form.id,
        formTitle: form.title,
        document: req.name,
        requirementName: req.name,
        type: req.type || form.type || 'Certificate',
        expiry: expiryDate || '',
        fileUrl: uploadedUrl,
        targetType: form.targetType || 'all',
        notes: '',
      });
      closeSubmit();
      await load();
    } catch (err) {
      alert('Failed to submit document: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Compliance &amp; Documents</h1>
          <p className="subtitle">Submit and track the documents required for you at {selectedClub?.name}</p>
        </div>
        <button className="btn btn-outline" onClick={load}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Loading your requirements...</p>
      ) : applicableForms.length === 0 ? (
        <div className="card shadow-sm" style={{ padding: '60px 20px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '16px', background: '#fff' }}>
          <ShieldCheck size={40} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: 0 }}>You're all clear</h3>
          <p className="text-muted" style={{ marginTop: '6px' }}>No compliance documents are currently required for you.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {applicableForms.map(form => {
            const reqs = (form.requirements && form.requirements.length > 0)
              ? form.requirements
              : [{ name: form.title, type: form.type || 'Certificate', mandatory: true, expiryRequired: !!form.expiryRequired, notes: '' }];

            const completed = reqs.filter(r => {
              const s = submissionFor(form.id, r.name);
              return s && s.status === 'Approved';
            }).length;

            return (
              <div key={form.id} className="card shadow-sm" style={{ border: '1px solid var(--border)', borderRadius: '16px', background: '#fff', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: 800 }}>{form.title}</h3>
                    <p className="text-muted" style={{ margin: 0, fontSize: '13px' }}>{form.description || 'Club compliance requirement'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-info">{form.type || 'Certificate'}</span>
                    <span className="badge badge-default" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {completed}/{reqs.length} complete
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', margin: '14px 0 16px' }}>
                  <div style={{ width: `${reqs.length ? (completed / reqs.length) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', transition: 'width 0.25s' }} />
                </div>

                {/* Requirements list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {reqs.map((req, i) => {
                    const sub = submissionFor(form.id, req.name);
                    const meta = sub ? (STATUS_META[sub.status] || STATUS_META.Pending) : null;
                    const StatusIcon = meta?.icon;
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', background: '#f8fafc', border: '1px solid var(--border-light, #f1f5f9)', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
                          <FileText size={18} color="var(--text-secondary)" />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{req.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{req.type}</span>
                              {req.mandatory ? <span style={{ color: '#ef4444' }}>Required</span> : <span>Optional</span>}
                              {req.expiryRequired && <span>· Expiry needed</span>}
                            </div>
                            {req.notes && <div style={{ fontSize: '11px', color: 'var(--text-lighter)', marginTop: '2px' }}>{req.notes}</div>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {meta && (
                            <span className={`badge ${meta.badge}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <StatusIcon size={12} /> {meta.label}
                            </span>
                          )}
                          {sub && sub.status !== 'Approved' && (
                            <button className="btn btn-outline btn-sm" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => openSubmit(form, req)}>
                              Re-upload
                            </button>
                          )}
                          {!sub && (
                            <button className="btn btn-primary btn-sm" style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }} onClick={() => openSubmit(form, req)}>
                              <Upload size={13} /> Upload
                            </button>
                          )}
                          {sub?.fileUrl && (
                            <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: 600 }}>
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Scope indicator */}
                <div style={{ marginTop: '14px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  {form.targetType === 'all' || (!form.targetTeamIds?.length && !form.targetGroupIds?.length) ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> Club-wide requirement</span>
                  ) : (
                    <>
                      {form.targetTeamIds?.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> {form.targetTeamIds.map(id => teams.find(t => t.id === id)?.name).filter(Boolean).join(', ')}</span>}
                      {form.targetGroupIds?.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Layers size={12} /> {form.targetGroupIds.map(id => groups.find(g => g.id === id)?.name).filter(Boolean).join(', ')}</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload / Submit Modal */}
      <Modal
        open={!!activeReq}
        onClose={closeSubmit}
        title={activeReq ? `Submit: ${activeReq.req.name}` : 'Submit Document'}
      >
        {activeReq && (
          <div>
            <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border-light, #f1f5f9)' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{activeReq.req.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Part of "{activeReq.form.title}" · {activeReq.req.type}
              </div>
              {activeReq.req.notes && <div style={{ fontSize: '12px', color: 'var(--text-lighter)', marginTop: '6px' }}>{activeReq.req.notes}</div>}
            </div>

            <FileUpload
              title="Upload your document"
              subtitle="Images or PDF accepted"
              storagePath={`clubs/${selectedClubId}/compliance/${user?.uid || 'member'}`}
              autoUpload
              onUploadComplete={(url) => setUploadedUrl(url)}
            />

            {activeReq.req.expiryRequired && (
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Expiry Date <span className="text-danger">*</span>
                </label>
                <input type="date" className="form-control" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            )}

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={closeSubmit} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !uploadedUrl}>
                {saving ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
