import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ListTodo } from 'lucide-react';
import { API_BASE } from '../apiBase';
import { useI18n } from '../i18n/LocaleContext';

const TasksView: React.FC = () => {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');

  const refresh = useCallback(async () => {
    const r = await axios.get(`${API_BASE}/v3/tasks`);
    setTasks(r.data?.tasks || []);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    if (!title.trim()) return;
    await axios.post(`${API_BASE}/v3/tasks`, { title: title.trim() });
    setTitle('');
    await refresh();
  };

  return (
    <div style={{ padding: 28, maxWidth: 720, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <h1 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 20 }}>
        <ListTodo size={20} /> {t('tasks.title')}
      </h1>
      <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>{t('tasks.hint')}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('tasks.placeholder')}
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'transparent', color: 'hsl(var(--text-primary))' }} />
        <button type="button" onClick={() => void create()} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'hsl(var(--accent))', color: '#fff' }}>
          {t('tasks.create')}
        </button>
      </div>
      {tasks.map((task) => (
        <div key={task.id} style={{ padding: 12, marginBottom: 8, borderRadius: 10, border: '1px solid hsl(var(--border) / 0.5)' }}>
          <strong>{task.title}</strong>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{task.status} · {task.updated_at || task.updatedAt}</div>
        </div>
      ))}
    </div>
  );
};

export default TasksView;
