// src/features/habits/EnergyPanel.jsx
// FR#196 — Energy ecology panel: rolling weekly drain/regenerate entries side by side.

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { computeWeeklyEnergy } from './analyticsUtils.js';

const NUM_WEEKS = 12;
const ENERGY_COLOR = '#f48fb1'; // energy_audit habit color

function EnergyPanel({ entries, today }) {
  const weeklyEnergy = useMemo(
    () => computeWeeklyEnergy(entries, today, NUM_WEEKS),
    [entries, today]
  );

  if (weeklyEnergy.length === 0) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: COLORS.muted, textAlign: 'center' }}>
        No Energy Audit entries yet — log your first weekly entry to build your ecology.
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.text2, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Energy Ecology — Rolling {NUM_WEEKS} Weeks
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>⬇</span> Drain
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span>⬆</span> Regenerate
        </div>
      </div>

      {weeklyEnergy.map((w, wi) => (
        <div key={w.weekStart} style={{ marginBottom: wi < weeklyEnergy.length - 1 ? 20 : 0 }}>
          {/* Week label */}
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${COLORS.border}` }}>
            Week of {w.label}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Drain column */}
            <div>
              {w.drain.length === 0 ? (
                <span style={{ fontSize: 12, color: COLORS.muted, fontStyle: 'italic' }}>—</span>
              ) : (
                w.drain.map((text, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize:     12,
                      color:        COLORS.text,
                      background:   COLORS.surface2,
                      borderRadius: 6,
                      padding:      '8px 10px',
                      marginBottom: i < w.drain.length - 1 ? 6 : 0,
                      borderLeft:   `3px solid ${ENERGY_COLOR}44`,
                      lineHeight:   1.4,
                    }}
                  >
                    {text}
                  </div>
                ))
              )}
            </div>

            {/* Regenerate column */}
            <div>
              {w.regenerate.length === 0 ? (
                <span style={{ fontSize: 12, color: COLORS.muted, fontStyle: 'italic' }}>—</span>
              ) : (
                w.regenerate.map((text, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize:     12,
                      color:        COLORS.text,
                      background:   COLORS.surface2,
                      borderRadius: 6,
                      padding:      '8px 10px',
                      marginBottom: i < w.regenerate.length - 1 ? 6 : 0,
                      borderLeft:   `3px solid ${ENERGY_COLOR}88`,
                      lineHeight:   1.4,
                    }}
                  >
                    {text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

EnergyPanel.propTypes = {
  entries: PropTypes.array.isRequired,
  today:   PropTypes.instanceOf(Date).isRequired,
};

export { EnergyPanel };
