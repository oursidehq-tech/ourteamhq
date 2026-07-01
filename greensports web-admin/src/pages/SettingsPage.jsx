import { useState } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { useAuth } from '../context/AuthContext';
import { Settings, Shield, Database, Globe, Crown, UserPlus, Users } from 'lucide-react';

export default function SettingsPage() {
  const { selectedClub, clubs } = useClub();
  const { logout, isOwnerOf, profile, user, ownerClubIds } = useAuth();
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteStatus, setPromoteStatus] = useState('');
  const [promoting, setPromoting] = useState(false);

  const isOwner = selectedClub ? isOwnerOf(selectedClub.id) : false;

  // Owner can promote a club member to Admin
  const handlePromoteAdmin = async () => {
    if (!promoteEmail.trim() || !selectedClub) return;
    setPromoting(true);
    setPromoteStatus('');
    try {
      const { collection: colFn, getDocs, query, where } = await import('firebase/firestore');
      // Find user by email
      const q = query(colFn(db, 'users'), where('email', '==', promoteEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setPromoteStatus('No user found with that email.');
        setPromoting(false);
        return;
      }
      const targetDoc = snap.docs[0];
      const targetData = targetDoc.data();

      // Check if user is a member of this club
      const memberSnap = await getDoc(doc(db, 'clubs', selectedClub.id, 'members', targetDoc.id));
      if (!memberSnap.exists()) {
        setPromoteStatus('This user is not a member of the selected club. They must join first.');
        setPromoting(false);
        return;
      }

      // Update member sub-doc to Admin
      await updateDoc(doc(db, 'clubs', selectedClub.id, 'members', targetDoc.id), {
        role: 'Admin',
        updatedAt: serverTimestamp(),
      });

      // Sync to user's clubMemberships
      const memberships = targetData.clubMemberships || [];
      const updated = memberships.map(m =>
        m.clubId === selectedClub.id ? { ...m, role: 'Admin' } : m
      );
      await updateDoc(doc(db, 'users', targetDoc.id), { clubMemberships: updated, updatedAt: serverTimestamp() });

      setPromoteStatus(`${targetData.displayName || promoteEmail} is now an Admin of ${selectedClub.name}!`);
      setPromoteEmail('');
    } catch (err) {
      setPromoteStatus('Error: ' + err.message);
    }
    setPromoting(false);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Settings</h1><p>Club management and admin controls</p></div>
      </div>

      <div style={{ display: 'grid', gap: 20, maxWidth: 700 }}>
        {/* Current User */}
        <div className="table-container">
          <div className="table-toolbar"><h3>{isOwner ? <Crown size={16} style={{ marginRight: 6 }} /> : <Shield size={16} style={{ marginRight: 6 }} />}Your Account</h3></div>
          <div style={{ padding: 20 }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td style={{ fontWeight: 600, paddingRight: 16 }}>Name</td><td>{profile?.displayName || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Email</td><td>{user?.email || '—'}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Role</td><td><span className={`badge ${isOwner ? 'badge-danger' : 'badge-warning'}`}>{isOwner ? 'Owner' : 'Admin'}</span></td></tr>
                <tr><td style={{ fontWeight: 600 }}>Clubs You Own</td><td>{ownerClubIds.length}</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Total Clubs</td><td>{clubs.length}</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-danger" onClick={logout} style={{ marginTop: 8 }}>Sign Out</button>
            </div>
          </div>
        </div>

        {/* Owner: Promote users to Admin */}
        {isOwner && selectedClub && (
          <div className="table-container">
            <div className="table-toolbar"><h3><UserPlus size={16} style={{ marginRight: 6 }} />Promote to Admin</h3></div>
            <div style={{ padding: 20 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                Promote an existing club member to <strong>Admin</strong> for <strong>{selectedClub.name}</strong>. They'll be able to manage members, events, teams, and the shop through this web panel.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-control" placeholder="Member's email address" value={promoteEmail} onChange={e => setPromoteEmail(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={handlePromoteAdmin} disabled={promoting}>{promoting ? 'Promoting…' : 'Promote'}</button>
              </div>
              {promoteStatus && <p style={{ fontSize: 13, marginTop: 8, color: promoteStatus.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>{promoteStatus}</p>}
            </div>
          </div>
        )}

        {/* Role Hierarchy Documentation */}
        <div className="table-container">
          <div className="table-toolbar"><h3><Users size={16} style={{ marginRight: 6 }} />Role Hierarchy</h3></div>
          <div style={{ padding: 20, lineHeight: 1.8, color: 'var(--text-secondary)', fontSize: 13 }}>
            <p><strong>How roles work (same as real sports clubs):</strong></p>
            <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Role</th>
                  <th style={{ padding: '8px 12px' }}>Who</th>
                  <th style={{ padding: '8px 12px' }}>Permissions</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}><span className="badge badge-danger">Owner</span></td>
                  <td style={{ padding: '8px 12px' }}>Person who created the club</td>
                  <td style={{ padding: '8px 12px' }}>Full control. Can assign any role including Admin. Can delete club. Web admin access.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}><span className="badge badge-warning">Admin</span></td>
                  <td style={{ padding: '8px 12px' }}>Appointed by Owner</td>
                  <td style={{ padding: '8px 12px' }}>Full management. Members, events, teams, shop. Can assign Coach/Manager/Player/Parent/Volunteer. Web admin access.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}><span className="badge badge-info">Coach</span></td>
                  <td style={{ padding: '8px 12px' }}>Team-level leader</td>
                  <td style={{ padding: '8px 12px' }}>Manage their teams, create events, take attendance. Mobile app only.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}><span className="badge badge-info">Manager</span></td>
                  <td style={{ padding: '8px 12px' }}>Team logistics</td>
                  <td style={{ padding: '8px 12px' }}>Manage schedules, rosters, communicate. Mobile app only.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}><span className="badge badge-default">Player</span></td>
                  <td style={{ padding: '8px 12px' }}>Active member</td>
                  <td style={{ padding: '8px 12px' }}>View schedule, RSVP, shop, view team info. Mobile app only.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}><span className="badge badge-default">Parent</span></td>
                  <td style={{ padding: '8px 12px' }}>Guardian of player</td>
                  <td style={{ padding: '8px 12px' }}>View child's schedule, communicate with coaches. Mobile app only.</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px' }}><span className="badge badge-success">Volunteer</span></td>
                  <td style={{ padding: '8px 12px' }}>Event/duty helper</td>
                  <td style={{ padding: '8px 12px' }}>View assigned tasks, sign up for shifts. Mobile app only.</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: 12 }}><strong>How it works:</strong> When someone signs up and selects "Club Owner", they create a new club and become the Owner. Everyone else joins using the 6-digit invite code. The Owner assigns roles from the Members page or this Settings panel.</p>
          </div>
        </div>

        {/* Active Club */}
        {selectedClub && (
          <div className="table-container">
            <div className="table-toolbar"><h3><Globe size={16} style={{ marginRight: 6 }} />Active Club</h3></div>
            <div style={{ padding: 20 }}>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr><td style={{ fontWeight: 600, paddingRight: 16 }}>Name</td><td>{selectedClub.name}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Sport</td><td>{selectedClub.sport || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Location</td><td>{selectedClub.location || '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Invite Code</td><td><code>{selectedClub.inviteCode || '—'}</code></td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Plan</td><td>{selectedClub.plan || 'free'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* System */}
        <div className="table-container">
          <div className="table-toolbar"><h3><Database size={16} style={{ marginRight: 6 }} />System</h3></div>
          <div style={{ padding: 20 }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr><td style={{ fontWeight: 600, paddingRight: 16 }}>Platform</td><td>OurTeamHQ Admin Dashboard</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Version</td><td>1.0.0</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Backend</td><td>Firebase (Firestore + Auth + Storage)</td></tr>
                <tr><td style={{ fontWeight: 600 }}>Framework</td><td>React 18 + Vite</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
