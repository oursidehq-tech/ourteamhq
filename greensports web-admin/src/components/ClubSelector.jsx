import { useClub } from '../context/ClubContext';
import { Building2 } from 'lucide-react';

export default function ClubSelector() {
  const { clubs, selectedClubId, setSelectedClubId } = useClub();

  if (clubs.length === 0) return <p className="text-muted">No clubs yet</p>;

  return (
    <div className="club-selector">
      <Building2 size={16} />
      <select value={selectedClubId} onChange={e => setSelectedClubId(e.target.value)}>
        {clubs.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
