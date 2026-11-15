import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, getDocs, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { complianceService } from '../services/complianceService';
import Modal from '../components/Modal';
import FileUpload from '../components/FileUpload';
import {
  ShieldCheck, FileText, CheckCircle2, Clock, AlertCircle, Upload,
  Users, Layers, RefreshCw, Calendar, XCircle, ArrowUpRight,
  ExternalLink, User, Eye, AlertTriangle, File
} from 'lucide-react';
import { DESIGN_TOKENS } from '../services/trainingService';

const DEFAULT_VOLUNTEER_CHECKLIST = [
  { id: 'req-wwcc', name: 'WWCC', fullName: 'Working With Children Check (WWCC)', type: 'Certificate', expiryRequired: true },
  { id: 'req-cpr', name: 'CPR Certificate', fullName: 'CPR Certificate (HLTAID009)', type: 'Certificate', expiryRequired: true },
  { id: 'req-firstaid', name: 'First Aid Certificate', fullName: 'First Aid Certificate (HLTAID011)', type: 'Certificate', expiryRequired: true },
  { id: 'req-volagreement', name: 'Volunteer Agreement', fullName: 'Volunteer Agreement & Code of Conduct', type: 'Policy Agreement', expiryRequired: false },
];

export default function UserCompliance() {
  const { selectedClubId, selectedClub } = useClub();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);

  // Viewing selector: 'me' or childId
  const [viewingTarget, setViewingTarget] = useState('me');

  // Submit / Renew modal state
  const [activeReq, setActiveReq] = useState(null); // { name, type, ... }
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);

  // View submission modal
  const [viewingSub, setViewingSub] = useState(null);

  const loadData = useCallback(async () => {
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
    } finally {
      setLoading(false);
    }
  }, [selectedClubId, user?.uid]);

  useEffect(() => { loadData(); }, [loadData]);

  // Current user member record
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

  // Roles held by user in club
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

  // User's teams
  const myTeams = useMemo(() => {
    return teams.filter(t => {
      return t.memberIds?.includes(user?.uid) || 
        (clubMemberRecord && (t.memberIds?.includes(clubMemberRecord.id) || clubMemberRecord.teamIds?.includes(t.id)));
    });
  }, [teams, user, clubMemberRecord]);

  // Children belonging to this parent (if any)
  const childrenList = useMemo(() => {
    if (!clubMemberRecord) return [];
    return members.filter(m => 
      m.parentUid === user?.uid || 
      m.guardianEmail?.toLowerCase().trim() === user?.email?.toLowerCase().trim()
    );
  }, [members, user, clubMemberRecord]);

  // Active target member for compliance
  const activeSubject = useMemo(() => {
    if (viewingTarget === 'me' || !viewingTarget) {
      return {
        id: user?.uid,
        name: profile?.displayName || clubMemberRecord?.displayName || clubMemberRecord?.name || 'Me',
        role: myRoles.join(', ') || 'Volunteer',
        team: myTeams[0]?.name || 'U17'
      };
    }
    const child = childrenList.find(c => c.id === viewingTarget);
    return {
      id: child?.id,
      name: child?.displayName || child?.name || 'Child',
      role: 'Player',
      team: teams.find(t => t.id === child?.teamIds?.[0])?.name || 'Junior'
    };
  }, [viewingTarget, user, profile, clubMemberRecord, myRoles, myTeams, childrenList, teams]);

  // Standard requirements list for active role
  const requirementsList = useMemo(() => {
    // If club admin defined complianceForms matching role/team, extract requirements
    const applicableForms = forms.filter(f => f.targetType === 'all' || (f.targetRoles || []).some(r => myRoles.includes(r)));
    if (applicableForms.length > 0 && applicableForms[0].requirements?.length > 0) {
      return applicableForms[0].requirements;
    }
    return DEFAULT_VOLUNTEER_CHECKLIST;
  }, [forms, myRoles]);

  // Compute status for each requirement
  const computedRequirements = useMemo(() => {
    return requirementsList.map(req => {
      const sub = submissions.find(s => 
        (s.document === req.name || s.requirementName === req.name || s.name === req.name) &&
        (viewingTarget === 'me' ? (s.uid === user?.uid || s.memberId === clubMemberRecord?.id) : s.memberId === viewingTarget)
      );

      const status = complianceService.calculateStatus(sub, req);
      return {
        ...req,
        submission: sub,
        computedStatus: status,
        expiryDate: sub?.expiryDate || sub?.expiry || null,
        submittedAt: sub?.submittedAt || null
      };
    });
  }, [requirementsList, submissions, viewingTarget, user, clubMemberRecord]);

  // Summary counts (Concept badges: Current, Pending, Expiring soon, Action required)
  const stats = useMemo(() => {
    let current = 0;
    let pending = 0;
    let expiring = 0;
    let actionRequired = 0;

    computedRequirements.forEach(r => {
      if (r.computedStatus === 'Current') current++;
      else if (r.computedStatus === 'Pending review') pending++;
      else if (r.computedStatus === 'Expiring soon') expiring++;
      else actionRequired++; // Missing, Expired, Rejected
    });

    return { current, pending, expiring, actionRequired };
  }, [computedRequirements]);

  // Submit / Upload Handler
  const handleDocumentSubmit = async () => {
    if (!activeReq) return;
    if (!uploadedUrl) {
      alert('Please select or upload a document file.');
      return;
    }
    if (activeReq.expiryRequired && !expiryDate) {
      alert('Please specify the document expiration date.');
      return;
    }

    setSaving(true);
    try {
      await complianceService.submitComplianceDocument(selectedClubId, {
        uid: activeSubject.id,
        memberId: activeSubject.id,
        userName: activeSubject.name,
        name: activeSubject.name,
        email: user?.email || '',
        role: activeSubject.role,
        requirementName: activeReq.name,
        document: activeReq.name,
        type: activeReq.type || 'Certificate',
        expiryDate: expiryDate || '',
        expiry: expiryDate || '',
        fileUrl: uploadedUrl,
        submittedAt: new Date().toISOString()
      });

      alert('Document submitted successfully! Sent to club reviewers.');
      setActiveReq(null);
      setUploadedUrl('');
      setExpiryDate('');
      loadData();
    } catch (err) {
      alert('Error submitting document: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px', fontFamily: 'Arial, sans-serif' }}>
      
      {/* Top Header matching Concept */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
              My Compliance
            </h1>
            <span style={{ fontSize: '11px', fontWeight: 600, background: '#0D9488', color: '#FFFFFF', padding: '3px 10px', borderRadius: '999px' }}>
              Concept • Example data
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Your requirements, documents and upcoming renewals
          </p>
        </div>

        {/* Viewing Selector & Role Pill */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            value={viewingTarget}
            onChange={e => setViewingTarget(e.target.value)}
            style={{ width: 'auto', fontSize: '13px', fontWeight: 600, borderRadius: '10px', padding: '6px 12px' }}
          >
            <option value="me">Viewing: Me</option>
            {childrenList.map(c => (
              <option key={c.id} value={c.id}>Viewing: {c.displayName || c.name} (Child)</option>
            ))}
          </select>

          <span style={{ fontSize: '12px', fontWeight: 700, background: '#F1F5F9', color: '#334155', padding: '8px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            {activeSubject.role} • {activeSubject.team}
          </span>
        </div>
      </div>

      {/* Main Grid: Checklist Card on Left + Side Notification Widget on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Checklist Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
            Team Volunteers Checklist
          </h3>

          {/* 4 Summary Stat Pills (Image 6) */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', padding: '6px 12px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} /> {stats.current} current
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A', padding: '6px 12px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <User size={13} /> {stats.pending} pending
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, background: '#FFFBEB', color: '#B45309', border: '1px solid #FCD34D', padding: '6px 12px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} /> {stats.expiring} expiring soon
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '6px 12px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={13} /> {stats.actionRequired} action required
            </span>
          </div>

          {/* Requirements Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#64748B' }}>
                <th style={{ padding: '12px 14px' }}>Requirement</th>
                <th style={{ padding: '12px 14px' }}>Status</th>
                <th style={{ padding: '12px 14px' }}>Date</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {computedRequirements.map(req => {
                const isCurrent = req.computedStatus === 'Current';
                const isExpiring = req.computedStatus === 'Expiring soon';
                const isPending = req.computedStatus === 'Pending review';
                const isActionReq = req.computedStatus === 'Missing' || req.computedStatus === 'Expired' || req.computedStatus === 'Rejected';

                return (
                  <tr key={req.name} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 14px', fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                      {req.name}
                    </td>

                    <td style={{ padding: '14px 14px' }}>
                      {isCurrent && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={13} color="#16A34A" /> Current
                        </span>
                      )}
                      {isExpiring && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} color="#D97706" /> Expiring soon
                        </span>
                      )}
                      {isPending && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} color="#D97706" /> Pending review
                        </span>
                      )}
                      {isActionReq && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertCircle size={13} color="#DC2626" /> {req.computedStatus}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 14px', fontSize: '12px', color: '#64748B' }}>
                      {req.expiryDate ? `Expires ${req.expiryDate}` : req.submittedAt ? `Submitted recently` : 'No submission'}
                    </td>

                    <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                      {isCurrent && (
                        <button
                          onClick={() => setViewingSub(req.submission)}
                          className="btn btn-outline"
                          style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '8px' }}
                        >
                          View
                        </button>
                      )}
                      {isExpiring && (
                        <button
                          onClick={() => { setActiveReq(req); setExpiryDate(req.expiryDate || ''); }}
                          className="btn btn-primary"
                          style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '8px', background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
                        >
                          Renew
                        </button>
                      )}
                      {isPending && (
                        <button
                          onClick={() => setViewingSub(req.submission)}
                          className="btn btn-outline"
                          style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '8px' }}
                        >
                          View submission
                        </button>
                      )}
                      {isActionReq && (
                        <button
                          onClick={() => { setActiveReq(req); setExpiryDate(''); }}
                          className="btn btn-primary"
                          style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '8px', background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
                        >
                          Upload
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer Allowed Formats note */}
          <div style={{ marginTop: '20px', fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={12} /> PDF, JPG or PNG • Up to 10MB • Camera or file
          </div>

        </div>

        {/* Right Column: Side Card Update Widget (Image 6) */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', marginBottom: '4px' }}>
            Compliance update • Your WWCC has been approved.
          </div>
          <button
            onClick={() => {
              const wwcc = computedRequirements.find(r => r.name.toLowerCase().includes('wwcc'));
              if (wwcc?.submission) setViewingSub(wwcc.submission);
              else alert('WWCC is in valid approved status.');
            }}
            style={{ background: 'none', border: 'none', padding: 0, color: '#0D9488', fontWeight: 700, fontSize: '12px', cursor: 'pointer', marginTop: '6px' }}
          >
            View requirement
          </button>
        </div>

      </div>

      {/* ─── MODAL: UPLOAD / RENEW REQUIREMENT ───────────────────────────────── */}
      <Modal
        open={!!activeReq}
        onClose={() => setActiveReq(null)}
        title={`Upload Evidence: ${activeReq?.name || 'Document'}`}
      >
        {activeReq && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
              Upload your verification evidence for <strong>{activeReq.name}</strong>. Files are securely audited by club administrators.
            </p>

            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 700 }}>Document File (PDF, JPG, PNG up to 10MB)</label>
              <FileUpload
                accept="application/pdf,image/png,image/jpeg"
                maxSizeMB={10}
                onFileUploaded={url => setUploadedUrl(url)}
              />
              {uploadedUrl && (
                <div style={{ fontSize: '12px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                  <CheckCircle2 size={14} /> File uploaded ready to submit
                </div>
              )}
            </div>

            {activeReq.expiryRequired && (
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Expiration Date (Required)</label>
                <input
                  type="date"
                  className="form-control"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setActiveReq(null)} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDocumentSubmit}
                disabled={saving || !uploadedUrl}
                style={{ background: DESIGN_TOKENS.primaryTeal, borderColor: DESIGN_TOKENS.primaryTeal }}
              >
                {saving ? 'Submitting...' : 'Submit Evidence'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: VIEW SUBMISSION ─────────────────────────────────────────── */}
      <Modal
        open={!!viewingSub}
        onClose={() => setViewingSub(null)}
        title="Compliance Submission Record"
      >
        {viewingSub && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Requirement</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                {viewingSub.requirementName || viewingSub.document || 'Compliance Check'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Status</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  {viewingSub.status || 'Approved'}
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Expiry Date</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  {viewingSub.expiryDate || viewingSub.expiry || 'No expiry'}
                </div>
              </div>
            </div>

            {viewingSub.fileUrl && (
              <a
                href={viewingSub.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
              >
                <File size={16} /> View Uploaded Document <ExternalLink size={14} />
              </a>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => setViewingSub(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
