import { Crown, Medal, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useUi } from '../store/ui';
import { Avatar, PageLoader } from '../components/ui';

interface Row {
  position: number;
  id: string;
  displayName: string;
  avatarColor: string;
  plays: number;
}

export function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const pushToast = useUi((state) => state.pushToast);

  useEffect(() => {
    api
      .leaderboard()
      .then((data) => setRows(data.users))
      .catch((error) => pushToast((error as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [pushToast]);

  if (loading) return <PageLoader />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Trophy size={14} /> геймификация
          </p>
          <h1>Рейтинг слушателей</h1>
          <p className="page-subtitle">Кто слушает больше всех. Прослушивания считаются автоматически.</p>
        </div>
      </header>

      <div className="leaderboard">
        {rows.map((row) => (
          <Link key={row.id} to={`/u/${row.id}`} className={`leader-row rank-${row.position}`}>
            <span className="leader-position">
              {row.position === 1 ? (
                <Crown size={20} />
              ) : row.position <= 3 ? (
                <Medal size={18} />
              ) : (
                row.position
              )}
            </span>
            <Avatar name={row.displayName} color={row.avatarColor} size={44} />
            <div className="leader-meta">
              <strong>{row.displayName}</strong>
              <span>{row.plays} прослушиваний</span>
            </div>
            <span className="leader-plays">{row.plays}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
