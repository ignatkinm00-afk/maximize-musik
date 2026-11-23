import { Compass, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        icon={Compass}
        title="404 — страница потерялась"
        description="Возможно, ссылка устарела. Вернись на главную и продолжи слушать."
        action={
          <Link to="/" className="btn btn-primary">
            <Home size={16} /> На главную
          </Link>
        }
      />
    </div>
  );
}
