import React from 'react';
import { XIcon } from '../icons';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ExchangeChartModalProps {
    isOpen: boolean;
    onClose: () => void;
    city: string | null;
    currency: string;
    chartData: any[];
    loading: boolean;
    error: string | null;
}

const ExchangeChartModal: React.FC<ExchangeChartModalProps> = ({
    isOpen, onClose, city, currency, chartData, loading, error
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-slate-700/50 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg p-5 sm:p-7 relative animate-fade-in-up"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                    <XIcon className="w-6 h-6" />
                </button>

                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    {city} ({currency}) 환율 변동 추이
                </h3>
                <p className="text-sm text-slate-400 mb-6">최근 1개월간 현지통화 대비 원화(KRW) 기준 가격 흐름을 나타냅니다.</p>

                <div className="h-64 sm:h-72 w-full mt-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-slate-400">데이터를 불러오는 중입니다...</div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-400 text-center px-4">{error}</div>
                    ) : chartData && chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickMargin={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickFormatter={(val) => Math.round(val).toLocaleString()}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        borderColor: '#334155',
                                        borderRadius: '0.5rem',
                                        color: '#f8fafc'
                                    }}
                                    itemStyle={{ color: '#38bdf8' }}
                                    formatter={(value: number) => [`${value.toLocaleString()} 원`, `1 ${currency}`]}
                                    labelFormatter={(label) => `날짜: ${label}`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="rate"
                                    stroke="#38bdf8"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#0f172a', stroke: '#38bdf8', strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: '#38bdf8' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">표시할 데이터가 없습니다.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExchangeChartModal;
