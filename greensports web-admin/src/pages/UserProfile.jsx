import { useState, useMemo } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useClub } from '../context/ClubContext';
import { User, Phone, Mail, Building, Plus, SwitchCamera, Check, Link2, FileKey, ShieldAlert } from 'lucide-react';

export default function UserProfile() {
  const { user, profile, joinClubWithCode } = useAuth();
  const { selectedClubId, setSelectedClubId, clubs } = useClub();

  // Profile Form state
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Invite Code state
  const [inviteCode, setInviteCode] = useState('');
  const [joiningClub, setJoiningClub] = useState(false);

  // Parent/Player linking mock state
  const [linkedPlayers, setLinkedPlayers] = useState([
    { id: 'mock-1', name: 'Alex Smith', ageGroup: 'U12 Boys', relationship: 'Child' },
    { id: 'mock-2', name: 'Emma Smith', ageGroup: 'U10 Girls', relationship: 'Child' }
  ]);
  const [childInviteCode, setChildInviteCode] = useState('');
  const [linkingChild, setLinkingChild] = useState(false);

  // Membership breakdown
  const memberships = useMemo(() => {
    return profile?.clubMemberships || [];
  }, [profile]);

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!displayName.trim()) return alert('Display name is required.');

    setSavingProfile(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        displayName: displayName.trim(),
        phone: phone.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert('Profile updated successfully.');
      // Page will automatically reflect change because Firebase Auth/Doc is synchronized
    } catch (err) {
      alert('Failed to update profile: ' + err.message);
    }
    setSavingProfile(false);
  };

  // Handle Join Club with Code
  const handleJoinClub = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setJoiningClub(true);
    try {
      const targetClub = await joinClubWithCode(inviteCode);
      if (targetClub) {
        alert(`Successfully joined ${targetClub.name}!`);
        setSelectedClubId(targetClub.id);
        setInviteCode('');
      }
    } catch (err) {
      alert('Failed to join club: ' + err.message);
    }
    setJoiningClub(false);
  };

  // Handle mock child linking
  const handleLinkChild = (e) => {
    e.preventDefault();
    if (!childInviteCode.trim()) return;

    setLinkingChild(true);
    setTimeout(() => {
      setLinkedPlayers(prev => [
        ...prev,
        {
          id: `child-${Date.now()}`,
          name: 'Tommy Smith',
          ageGroup: 'U14 Boys',
          relationship: 'Child'
        }
      ]);
      setChildInviteCode('');
      setLinkingChild(false);
      alert('Child player profile linked successfully!');
    }, 800);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Profile & Account Settings</h1>
          <p className="subtitle">Manage your personal credentials, joined clubs, family links, and billing configurations</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Personal info & family linking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Personal Details */}
          <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} color="var(--primary)" /> Personal Credentials
            </h3>

            <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label>Display Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    required
                    style={{ paddingLeft: '32px' }}
                  />
                  <User size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-secondary)' }} />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address (read-only)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    value={profile?.email || user?.email || ''}
                    disabled
                    style={{ paddingLeft: '32px', backgroundColor: '#f8fafc', color: 'var(--text-secondary)' }}
                  />
                  <Mail size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-lighter)' }} />
                </div>
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-control"
                    placeholder="e.g. +1 (555) 019-2834"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                  />
                  <Phone size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-secondary)' }} />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                {savingProfile ? 'Saving Details...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* Card: Parent-Player Family Linking */}
          <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link2 size={18} color="var(--primary)" /> Parent & Child Player Linking
            </h3>
            
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              Link your child's player profile to your account to sign checklists, RSVP to their training games, and manage their store orders directly from your web portal.
            </p>

            {/* List existing linked players */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {linkedPlayers.map(player => (
                <div key={player.id} style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-light, #f1f5f9)',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{player.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Classified: {player.ageGroup}</div>
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '10px' }}>{player.relationship}</span>
                </div>
              ))}
            </div>

            {/* Link child form */}
            <form onSubmit={handleLinkChild} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', borderTop: '1px solid var(--border-light, #f1f5f9)', paddingTop: '16px' }}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label>Player Association Invite Code</label>
                <input
                  className="form-control"
                  placeholder="Enter child's 6-digit code..."
                  value={childInviteCode}
                  onChange={e => setChildInviteCode(e.target.value)}
                  style={{ borderRadius: '10px' }}
                />
              </div>
              <button type="submit" className="btn btn-outline" disabled={linkingChild} style={{ borderRadius: '10px', whiteSpace: 'nowrap' }}>
                {linkingChild ? 'Linking...' : 'Link Child'}
              </button>
            </form>
          </div>

        </div>

        {/* Right Column: Club switching & join with code */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Switch / Active Club Context */}
          <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SwitchCamera size={18} color="var(--primary)" /> Switch Active Club
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {memberships.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--text-lighter)', margin: 0 }}>
                  You do not belong to any clubs yet. Join a club using a code below!
                </p>
              ) : (
                memberships.map(m => {
                  const isActive = m.clubId === selectedClubId;
                  return (
                    <button
                      key={m.clubId}
                      onClick={() => setSelectedClubId(m.clubId)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-light, #f1f5f9)'}`,
                        background: isActive ? 'rgba(16, 185, 129, 0.05)' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', color: isActive ? 'var(--primary)' : 'var(--text)' }}>
                          {m.clubName}
                        </strong>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          Role: {m.role}
                        </div>
                      </div>
                      {isActive && <Check size={16} color="var(--primary)" strokeWidth={3} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Card: Join New Club */}
          <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} color="var(--primary)" /> Connect New Club
            </h3>
            
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              Enter a 6-character invitation code provided by your coach, parent, or club coordinator to register in another club.
            </p>

            <form onSubmit={handleJoinClub} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <input
                  className="form-control"
                  placeholder="Invite Code (e.g. A3B9X2)"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  maxLength={10}
                  style={{ textTransform: 'uppercase', textAlign: 'center', fontSize: '16px', fontWeight: 700, letterSpacing: '0.15em', borderRadius: '10px' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={joiningClub || !inviteCode.trim()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Plus size={16} /> {joiningClub ? 'Connecting...' : 'Join Club'}
              </button>
            </form>
          </div>

          {/* Card: Account Compliance / Credentials */}
          <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileKey size={16} color="var(--primary)" /> Membership Status
            </h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: '#ecfdf5', color: '#047857', padding: '10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <Check size={14} />
              <span>Status: <strong>Active Member</strong></span>
            </div>
            
            <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Your account compliance holds full validation. All insurance waivers and medical disclosures are successfully logged.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
