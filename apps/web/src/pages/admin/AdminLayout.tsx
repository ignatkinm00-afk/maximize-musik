import { motion } from 'framer-motion';
import { BarChart3, Megaphone, Music4, Shield, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/admin', label: 'Обзор', icon: BarChart3, end: true },
  { to: '/admin/tracks', label: 'Треки', icon: Music4 },
  { to: '/admin/users', label: 'Пользователи', icon: Users },
  { to: '/admin/broadcast', label: 'Рассылка', icon: Megaphone },
];

export function AdminLayout() {
  return (
    <motion.div className="page admin-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <Shield size={13} /> Админ-панель
          </span>
          <h1>Управление Maximize</h1>
          <p>Контент, люди, уведомления и Telegram — в одном месте</p>
        </div>
      </div>

      <nav className="admin-tabs">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}>
            <tab.icon size={16} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </motion.div>
  );
}
