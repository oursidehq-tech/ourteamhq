import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCard({ icon: Icon, label, value, trend, color }) {
  const isPositive = trend?.startsWith('+');
  
  return (
    <div className="stats-marquee-card">
      <div className="sm-card-top">
        <div className="sm-icon" style={{ backgroundColor: color + '15', color: color }}>
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`sm-trend ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend}
          </div>
        )}
      </div>
      <div className="sm-card-body">
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
    </div>
  );
}
