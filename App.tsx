
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Flight, CurrencyInfo, CurrencyModalData, MonthlyModalData } from './types';
import { initialPilotSchedule, newFlightData, TODAY_STR } from './constants';
import { calculateCurrency } from './utils/helpers';
import { RefreshCwIcon, UploadCloudIcon } from './components/icons';
import FlightCard from './components/FlightCard';
import CurrencyCard from './components/CurrencyCard';
import BlockTimeCard from './components/BlockTimeCard';
import FlightDetailModal from './components/modals/FlightDetailModal';
import CurrencyDetailModal from './components/modals/CurrencyDetailModal';
import MonthlyScheduleModal from './components/modals/MonthlyScheduleModal';
import { getAllFlights, addFlight, updateFlight, deleteFlight, subscribeToAllFlights } from './src/firebase/database';
import { loginUser, logoutUser, registerUser, onAuthStateChange, getCurrentUser } from './src/firebase/auth';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';

export default function App() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [currencyModalData, setCurrencyModalData] = useState<CurrencyModalData | null>(null);
  const [monthlyModalData, setMonthlyModalData] = useState<MonthlyModalData | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [isLoginLoading, setIsLoginLoading] = useState<boolean>(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [registerError, setRegisterError] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const firebaseFlights = await getAllFlights();
      if (firebaseFlights && firebaseFlights.length > 0) {
        // Firebase에서 가져온 데이터는 이미 정렬된 배열 형태
        setFlights(firebaseFlights);
      } else {
        // Firebase에 데이터가 없으면 초기 데이터 사용
        setFlights([...initialPilotSchedule].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      }
    } catch (error) {
      console.error('Error fetching flights:', error);
      // 에러 시 초기 데이터 사용
      setFlights([...initialPilotSchedule].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
    
    // 실시간 데이터 구독
    const unsubscribe = subscribeToAllFlights((firebaseFlights) => {
      if (firebaseFlights && firebaseFlights.length > 0) {
        setFlights(firebaseFlights);
      }
    });
    
    // 컴포넌트 언마운트 시 구독 해제
    return () => unsubscribe();
  }, [fetchInitialData]);

  // 인증 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
    });
    
    return () => unsubscribe();
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const currentFlights = [...flights];
      if (!currentFlights.find(f => f.id === newFlightData.id)) {
        // Firebase에 새 비행 데이터 추가
        await addFlight(newFlightData);
        currentFlights.push(newFlightData);
      }
      setFlights(currentFlights.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      console.error('Error updating flights:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("Uploading file:", file.name);
      // Here you would typically process the file
    }
  };

  const handleUpdateFlightStatus = async (flightId: number, statusToToggle: 'departed' | 'landed') => {
    try {
      const newFlights = flights.map(f =>
        f.id === flightId ? { ...f, status: { ...f.status, [statusToToggle]: !f.status[statusToToggle] } } : f
      );
      setFlights(newFlights);
      const updatedFlight = newFlights.find(f => f.id === flightId);
      if (updatedFlight) {
        setSelectedFlight(updatedFlight);
        // Firebase에 업데이트된 비행 데이터 저장
        await updateFlight(flightId.toString(), updatedFlight);
      }
    } catch (error) {
      console.error('Error updating flight status:', error);
    }
  };
  
  const handleCurrencyCardClick = (type: 'takeoff' | 'landing', currencyInfo: CurrencyInfo) => {
    setCurrencyModalData({ title: type === 'takeoff' ? '이륙' : '착륙', events: currencyInfo.recentEvents });
  };
  
  const handleMonthClick = (month: number, monthFlights: Flight[]) => {
      setMonthlyModalData({ month, flights: monthFlights });
  };

  // 로그인 관련 핸들러들
  const handleLoginClick = () => {
    setIsLoginModalOpen(true);
    setLoginError('');
  };

  const handleLoginClose = () => {
    setIsLoginModalOpen(false);
    setLoginError('');
  };

  const handleLogin = async (email: string, password: string) => {
    setIsLoginLoading(true);
    setLoginError('');
    
    const result = await loginUser(email, password);
    
    if (result.success) {
      setIsLoginModalOpen(false);
    } else {
      setLoginError(result.error || '로그인에 실패했습니다.');
    }
    
    setIsLoginLoading(false);
  };

  // 회원가입 관련 핸들러들
  const handleShowRegister = () => {
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(true);
    setRegisterError('');
  };

  const handleRegisterClose = () => {
    setIsRegisterModalOpen(false);
    setRegisterError('');
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    setIsRegisterLoading(true);
    setRegisterError('');
    
    const result = await registerUser(email, password, displayName);
    
    if (result.success) {
      setIsRegisterModalOpen(false);
      // 회원가입 성공 후 자동 로그인
      const loginResult = await loginUser(email, password);
      if (!loginResult.success) {
        setLoginError('회원가입은 완료되었지만 자동 로그인에 실패했습니다. 다시 로그인해주세요.');
        setIsLoginModalOpen(true);
      }
    } else {
      setRegisterError(result.error || '회원가입에 실패했습니다.');
    }
    
    setIsRegisterLoading(false);
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    if (!result.success) {
      console.error('로그아웃 실패:', result.error);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-xl font-semibold text-gray-700 mt-4">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const today = new Date(TODAY_STR);
  today.setHours(0, 0, 0, 0);

  const upcomingFlights = flights.filter(f => new Date(f.date) >= today);
  const pastFlights = flights.filter(f => new Date(f.date) < today);
  const nextFlight = upcomingFlights[0];
  const lastFlight = pastFlights.length > 0 ? pastFlights[pastFlights.length - 1] : undefined;
  
  const takeoffCurrency = calculateCurrency(flights, 'takeoff', TODAY_STR);
  const landingCurrency = calculateCurrency(flights, 'landing', TODAY_STR);

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="container mx-auto p-4 md:p-6 lg:p-8 flex flex-col">
        <header className="mb-8 flex justify-between items-center">
            <div className="flex-1 flex justify-start">
                {user ? (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {user.displayName || user.email}님 환영합니다
                    </span>
                    <button 
                      onClick={handleLogout}
                      className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleLoginClick}
                    className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    로그인
                  </button>
                )}
            </div>
            <div className="flex-1 text-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Flight Dashboard</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">{new Date(TODAY_STR).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} 기준</p>
            </div>
            <div className="flex-1 flex justify-end items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xls,.xlsx"/>
                <button onClick={handleUploadClick} title="Upload Schedule" className="p-2 rounded-full text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"><UploadCloudIcon className="w-6 h-6" /></button>
                <button onClick={handleUpdate} disabled={isUpdating} title="Refresh Data" className="p-2 rounded-full text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCwIcon className={`w-6 h-6 ${isUpdating ? 'animate-spin' : ''}`} /></button>
            </div>
        </header>
        
        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-1">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">월별 비행 시간 (Block)</h2>
                <BlockTimeCard flights={flights} todayStr={TODAY_STR} onMonthClick={handleMonthClick} />
            </div>
            <div className="lg:col-span-2">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">이착륙 자격 현황</h2>
                <div className="grid grid-cols-2 gap-6">
                    <CurrencyCard title="이륙" currencyInfo={takeoffCurrency} onClick={() => handleCurrencyCardClick('takeoff', takeoffCurrency)} />
                    <CurrencyCard title="착륙" currencyInfo={landingCurrency} onClick={() => handleCurrencyCardClick('landing', landingCurrency)} />
                </div>
            </div>
        </section>

        <main className="flex-grow grid grid-cols-2 gap-6 sm:gap-8">
            <FlightCard flight={lastFlight} type="last" onClick={setSelectedFlight} todayStr={TODAY_STR} />
            <FlightCard flight={nextFlight} type="next" onClick={setSelectedFlight} todayStr={TODAY_STR} />
        </main>
        
        <footer className="text-center mt-8 text-sm text-gray-500">
            <p>Personal Flight Dashboard &copy; {new Date().getFullYear()}.</p>
        </footer>

        <FlightDetailModal flight={selectedFlight} onClose={() => setSelectedFlight(null)} onUpdateStatus={handleUpdateFlightStatus} />
        <CurrencyDetailModal data={currencyModalData} onClose={() => setCurrencyModalData(null)} />
        <MonthlyScheduleModal data={monthlyModalData} onClose={() => setMonthlyModalData(null)} />
        <LoginModal 
          isOpen={isLoginModalOpen}
          onClose={handleLoginClose}
          onLogin={handleLogin}
          onShowRegister={handleShowRegister}
          isLoading={isLoginLoading}
          error={loginError}
        />
        <RegisterModal 
          isOpen={isRegisterModalOpen}
          onClose={handleRegisterClose}
          onRegister={handleRegister}
          isLoading={isRegisterLoading}
          error={registerError}
        />
      </div>
    </div>
  );
}