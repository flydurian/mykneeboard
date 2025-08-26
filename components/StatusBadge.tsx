
import React from 'react';
import { FlightStatus } from '../types';

interface StatusBadgeProps {
    status?: FlightStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    if (!status) return null;
    
    const badges = [];
    if (status.departed) badges.push({ text: '이륙', style: 'bg-blue-100 text-blue-800' });
    if (status.landed) badges.push({ text: '착륙', style: 'bg-green-100 text-green-800' });
    
    if (badges.length === 0) return null;

    return (
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
            {badges.map(badge => (
                <div key={badge.text} className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.style}`}>
                    {badge.text}
                </div>
            ))}
        </div>
    );
};

export default StatusBadge;
