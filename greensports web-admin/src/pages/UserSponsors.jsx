import { useEffect, useState, useMemo } from 'react';
import { useClub } from '../context/ClubContext';
import { sponsorService } from '../services/sponsorService';
import { Award, Globe, Mail, Phone, RefreshCw, ExternalLink, Search } from 'lucide-react';

const TIER_ORDER = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Partner'];

/**
 * Member-facing, read-only directory of club sponsors grouped by tier.
 */
export default function UserSponsors() {
  const { selectedClubId, selectedClub } = useClub();
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!selectedClubId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await sponsorService.getSponsors(selectedClubId);
      setSponsors(data);
    } catch (err) {
      console.error('Error loading sponsors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedClubId]);

  const filtered = useMemo(() => {
    return sponsors.filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.tier?.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase())
    );
  }, [sponsors, search]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(s => {
      const tier = s.tier || 'Partner';
      (map[tier] = map[tier] || []).push(s);
    });
    return Object.entries(map).sort((a, b) => {
      const ai = TIER_ORDER.indexOf(a[0]);
      const bi = TIER_ORDER.indexOf(b[0]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [filtered]);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1>Our Sponsors</h1>
          <p className="subtitle">The partners supporting {selectedClub?.name}</p>
        </div>
        <button className="btn btn-outline" onClick={load}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="search-box" style={{ marginBottom: '18px', background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '8px', height: '44px' }}>
        <Search size={16} color="var(--text-secondary)" />
        <input
          placeholder="Search sponsors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: '14px', background: 'transparent' }}
        />
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0' }}>Loading sponsors...</p>
      ) : filtered.length === 0 ? (
        <div className="card shadow-sm" style={{ padding: '60px 20px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '16px', background: '#fff' }}>
          <Award size={36} color="var(--text-lighter)" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: 0, color: 'var(--text)' }}>No sponsors listed</h4>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: '13px' }}>Check back soon for our club partners.</p>
        </div>
      ) : (
        grouped.map(([tier, list]) => (
          <div key={tier} style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {tier} Sponsors
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {list.map(s => (
                <div key={s.id} className="card shadow-sm" style={{ border: '1px solid var(--border)', borderRadius: '14px', background: '#fff', padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    {s.logoUrl ? (
                      <img src={s.logoUrl} alt={s.name} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-light, #f1f5f9)' }} />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Award size={22} />
                      </div>
                    )}
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{s.name}</h4>
                      <span className="badge badge-info" style={{ fontSize: '10px', marginTop: '4px', display: 'inline-block' }}>{s.tier || tier}</span>
                    </div>
                  </div>
                  {s.description && (
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.description}</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {s.website && (
                      <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={13} /> {s.website.replace(/^https?:\/\//, '')} <ExternalLink size={11} />
                      </a>
                    )}
                    {s.email && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={13} /> {s.email}</span>}
                    {s.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={13} /> {s.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
