// src/features/tasks/AnalyticsArea.jsx
// Tab bar wrapper: Tasks analytics | Contacts analytics (FR#165).

import PropTypes from 'prop-types';
import { useState } from 'react';
import { COLORS } from '../../constants.jsx';
import { TaskAnalyticsView } from './TaskAnalyticsView.jsx';
import { ContactAnalyticsView } from '../contacts/ContactAnalyticsView.jsx';

const TABS = [
  { id: 'tasks',    label: 'Tasks' },
  { id: 'contacts', label: 'Contacts' },
];

function AnalyticsArea({ tasks, contacts, onNavigateToContact }) {
  const [tab, setTab] = useState('tasks');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface, flexShrink: 0, padding: '0 24px' }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? COLORS.text : COLORS.muted,
                cursor: 'pointer',
                borderBottom: `2px solid ${active ? COLORS.next : 'transparent'}`,
                marginBottom: -1,
                userSelect: 'none',
                transition: 'color 0.1s',
              }}
            >
              {t.label}
            </div>
          );
        })}
      </div>

      {/* Content */}
      {tab === 'tasks'
        ? <TaskAnalyticsView tasks={tasks} />
        : <ContactAnalyticsView contacts={contacts || []} onNavigateToContact={onNavigateToContact} />
      }
    </div>
  );
}

AnalyticsArea.propTypes = {
  tasks:               PropTypes.array.isRequired,
  contacts:            PropTypes.array,
  onNavigateToContact: PropTypes.func,
};

export { AnalyticsArea };
