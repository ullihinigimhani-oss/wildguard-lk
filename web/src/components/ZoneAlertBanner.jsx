import { useEffect, useState } from 'react';
import { useZoneAlerts } from '../contexts/ZoneAlertContext';

const getRiskColor = (riskLevel) => {
  switch (riskLevel) {
    case 'LOW': return '#f1c40f';
    case 'MEDIUM': return '#e67e22';
    case 'HIGH': return '#e74c3c';
    case 'CRITICAL': return '#8b0000';
    default: return '#f1c40f';
  }
};

const getRiskBgColor = (riskLevel) => {
  switch (riskLevel) {
    case 'LOW': return '#fff9e6';
    case 'MEDIUM': return '#fff3e6';
    case 'HIGH': return '#fee6e6';
    case 'CRITICAL': return '#fde6e6';
    default: return '#fff9e6';
  }
};

export default function ZoneAlertBanner() {
  const { alerts, dismissAlert } = useZoneAlerts();
  const [visibleAlerts, setVisibleAlerts] = useState([]);

  useEffect(() => {
    setVisibleAlerts(alerts);
  }, [alerts]);

  const handleDismiss = (alertId) => {
    dismissAlert(alertId);
  };

  if (visibleAlerts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '400px'
    }}>
      {visibleAlerts.map((alert) => {
        const isHighPriority = alert.riskLevel === 'HIGH' || alert.riskLevel === 'CRITICAL';
        
        // Auto-dismiss after 3 seconds for LOW/MEDIUM zones
        if (!isHighPriority) {
          setTimeout(() => {
            handleDismiss(alert.id);
          }, 3000);
        }

        return (
          <div
            key={alert.id}
            style={{
              background: getRiskBgColor(alert.riskLevel),
              borderLeft: `4px solid ${getRiskColor(alert.riskLevel)}`,
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'slideIn 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: '600', 
                  color: '#243b32', 
                  marginBottom: '4px',
                  fontSize: '14px' 
                }}>
                  ⚠️ Animal in {alert.riskLevel} Risk Zone
                </div>
                <div style={{ fontSize: '13px', color: '#67756d', marginBottom: '4px' }}>
                  <strong>{alert.animal.species}</strong> ({alert.animal.animalCode})
                </div>
                <div style={{ fontSize: '12px', color: '#67756d' }}>
                  Zone: {alert.zone.name}
                </div>
                <div style={{ fontSize: '11px', color: '#67756d', marginTop: '4px' }}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => handleDismiss(alert.id)}
                style={{
                  background: isHighPriority ? getRiskColor(alert.riskLevel) : 'transparent',
                  color: isHighPriority ? 'white' : '#67756d',
                  border: isHighPriority ? 'none' : '1px solid #cbd8cf',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  fontWeight: '500'
                }}
              >
                {isHighPriority ? 'Acknowledge' : '×'}
              </button>
            </div>
            {isHighPriority && (
              <div style={{ 
                fontSize: '11px', 
                color: '#67756d', 
                marginTop: '8px',
                fontStyle: 'italic'
              }}>
                Click Acknowledge to dismiss this alert
              </div>
            )}
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
