import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useClub } from '../context/ClubContext';
import { Building, MapPin, Trophy, Shield, Copy, Check, Users } from 'lucide-react';

export default function ClubInfo() {
  const { selectedClub } = useClub();
  const [memberCount, setMemberCount] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedClub?.id) return;
    const fetchMemberCount = async () => {
      try {
        const snap = await getDocs(collection(db, 'clubs', selectedClub.id, 'members'));
        setMemberCount(snap.docs.length);
      } catch (err) {
        console.error('Error fetching member count:', err);
      }
    };
    fetchMemberCount();
  }, [selectedClub]);

  const handleCopy = () => {
    if (!selectedClub?.inviteCode) return;
    navigator.clipboard.writeText(selectedClub.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!selectedClub) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No active club selected. Switch clubs in your Profile settings.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>Club Information</h1>
          <p className="subtitle">Overview and registry context details of your connected organization</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="card shadow-sm" style={{ border: '1px solid var(--border)', background: '#ffffff', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Brand Banner */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light, #f1f5f9)', paddingBottom: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '16px',
            backgroundColor: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)'
          }}>
            <Building size={40} />
          </div>
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
              {selectedClub.name}
            </h2>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Trophy size={14} color="var(--primary)" /> {selectedClub.sport || 'Sports'} Club
              </span>
              {selectedClub.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} color="var(--primary)" /> {selectedClub.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          
          {/* Card 1: Members Count */}
          <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light, #f1f5f9)', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Total Roster</div>
              <strong style={{ fontSize: '20px', color: 'var(--text)' }}>{memberCount} Active</strong>
            </div>
          </div>

          {/* Card 2: Plan Status */}
          <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light, #f1f5f9)', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Verification</div>
              <strong style={{ fontSize: '20px', color: 'var(--text)' }}>Validated</strong>
            </div>
          </div>

        </div>

        {/* Invite Code Box */}
        {selectedClub.inviteCode && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.04)',
            border: '1px dashed var(--primary)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            marginTop: '10px'
          }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>
              Invite New Members
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Share this invite code with players, parents, or coaches so they can quickly join {selectedClub.name} on the web platform or mobile app!
            </p>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'monospace', color: 'var(--text)' }}>
                {selectedClub.inviteCode}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: copied ? 'var(--primary)' : 'var(--text-secondary)',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Copy Invite Code"
              >
                {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
