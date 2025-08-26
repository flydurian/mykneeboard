
import { Flight } from './types';

export const initialPilotSchedule: Flight[] = [
  { id: -3, date: '2025-07-05', flightNumber: 'KE017', route: 'ICN/LAX', std: '14:30', sta: '09:50', block: 740, status: { departed: true, landed: true }, crew: [{ empl: '700001', name: '김기장', rank: 'CAP', posnType: 'TL', posn: 'C' }] },
  { id: -2, date: '2025-07-15', flightNumber: 'KE018', route: 'LAX/ICN', std: '12:30', sta: '17:50', block: 800, status: { departed: true, landed: true }, crew: [{ empl: '700001', name: '김기장', rank: 'CAP', posnType: 'TL', posn: 'C' }] },
  { id: -1, date: '2025-08-10', flightNumber: 'KE081', route: 'ICN/JFK', std: '10:00', sta: '11:05', block: 845, status: { departed: true, landed: true }, crew: [{ empl: '728642', name: '홍길동', rank: 'F/O', posnType: 'TL', posn: 'F2' }] },
  { id: 1, date: '2025-08-20', flightNumber: 'KE101', route: 'ICN/LAX', std: '10:00', sta: '05:50', block: 710, status: { departed: true, landed: true }, crew: [{ empl: '700001', name: '김기장', rank: 'CAP', posnType: 'TL', posn: 'C' },{ empl: '728642', name: '홍길동', rank: 'F/O', posnType: 'TL', posn: 'F2' }] },
  { id: 2, date: '2025-09-05', flightNumber: 'KE562', route: 'FCO/ICN', std: '05:20', sta: '06:40', block: 740, status: { departed: false, landed: false }, crew: [{ empl: '713253', name: '이재경', rank: 'CAP', posnType: 'CR', posn: 'C' },{ empl: '723755', name: '박부기', rank: 'F/O', posnType: 'TL', posn: 'F' },{ empl: '728642', name: '홍길동', rank: 'F/O', posnType: 'TL', posn: 'F2' }] },
  { id: 3, date: '2025-09-14', flightNumber: 'KE713', route: 'ICN/TPE', std: '14:00', sta: '15:50', block: 170, status: { departed: false, landed: false }, crew: [{ empl: '708868', name: '이정훈', rank: 'CAP', posnType: 'TL', posn: 'C' },{ empl: '728642', name: '홍길동', rank: 'F/O', posnType: 'TL', posn: 'F' }] },
];

export const newFlightData: Flight = { id: 4, date: '2025-09-25', flightNumber: 'KE023', route: 'ICN/SFO', std: '16:00', sta: '10:50', block: 650, status: { departed: false, landed: false }, crew: [{ empl: '700001', name: '김기장', rank: 'CAP', posnType: 'TL', posn: 'C' },{ empl: '728642', name: '홍길동', rank: 'F/O', posnType: 'TL', posn: 'F2' }] };

export const TODAY_STR = '2025-08-26';
