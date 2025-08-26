
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
import { getAllFlights, addFlight, updateFlight, deleteFlight, subscribeToAllFlights, addMultipleFlights } from './src/firebase/database';
import { loginUser, logoutUser, registerUser, onAuthStateChange, getCurrentUser } from './src/firebase/auth';
import { parseExcelFile } from './utils/excelParser';
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
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user) {
        // 로그인된 사용자의 데이터만 가져오기
        const firebaseFlights = await getAllFlights(user.uid);
        if (firebaseFlights && firebaseFlights.length > 0) {
          setFlights(firebaseFlights);
        } else {
          // 사용자별 데이터가 없으면 빈 배열
          setFlights([]);
        }
      } else {
        // 로그인되지 않은 경우 빈 배열
        setFlights([]);
      }
    } catch (error) {
      console.error('Error fetching flights:', error);
      setFlights([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInitialData();
    
    // 사용자가 로그인된 경우에만 실시간 데이터 구독
    if (user) {
      const unsubscribe = subscribeToAllFlights((firebaseFlights) => {
        if (firebaseFlights && firebaseFlights.length > 0) {
          setFlights(firebaseFlights);
        } else {
          setFlights([]);
        }
      }, user.uid);
      
      // 컴포넌트 언마운트 시 구독 해제
      return () => unsubscribe();
    }
  }, [fetchInitialData, user]);

  // 인증 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
    });
    
    return () => unsubscribe();
  }, []);

  const handleUpdate = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsUpdating(true);
    try {
      const currentFlights = [...flights];
      if (!currentFlights.find(f => f.id === newFlightData.id)) {
        // Firebase에 새 비행 데이터 추가 (사용자별)
        await addFlight(newFlightData, user.uid);
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 파일 확장자 확인
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['xls', 'xlsx'].includes(fileExtension || '')) {
      alert('Excel 파일(.xls, .xlsx)만 업로드 가능합니다.');
      return;
    }

    setIsUploading(true);
    setUploadMessage('파일을 처리하는 중...');

    try {
      // Excel 파일 파싱
      const flights = await parseExcelFile(file);
      
      if (flights.length === 0) {
        setUploadMessage('파일에서 비행 데이터를 찾을 수 없습니다.');
        return;
      }

      setUploadMessage(`${flights.length}개의 비행 데이터를 Firebase에 저장하는 중...`);

      // Firebase에 일괄 저장
      await addMultipleFlights(flights, user.uid);

      setUploadMessage(`${flights.length}개의 비행 데이터가 성공적으로 저장되었습니다!`);
      
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // 3초 후 메시지 제거
      setTimeout(() => {
        setUploadMessage('');
      }, 3000);

    } catch (error) {
      console.error('File upload error:', error);
      setUploadMessage(`파일 업로드 실패: ${error}`);
      
      // 5초 후 에러 메시지 제거
      setTimeout(() => {
        setUploadMessage('');
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  };



  const handleUpdateFlightStatus = async (flightId: number, statusToToggle: 'departed' | 'landed') => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const newFlights = flights.map(f =>
        f.id === flightId ? { ...f, status: { ...f.status, [statusToToggle]: !f.status[statusToToggle] } } : f
      );
      setFlights(newFlights);
      const updatedFlight = newFlights.find(f => f.id === flightId);
      if (updatedFlight) {
        setSelectedFlight(updatedFlight);
        // Firebase에 업데이트된 비행 데이터 저장 (사용자별)
        await updateFlight(flightId.toString(), updatedFlight, user.uid);
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

  // 로그인하지 않은 경우 안내 메시지 표시
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 font-sans">
        <div className="container mx-auto p-4 md:p-6 lg:p-8 flex flex-col">
          <header className="mb-8 flex justify-between items-center">
            <div className="flex-1 flex justify-start">
              <button 
                onClick={handleLoginClick}
                className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                로그인
              </button>
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Flight Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">비행 일정을 관리하세요</p>
            </div>
            <div className="flex-1"></div>
          </header>
          
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="bg-white rounded-lg p-8 shadow-lg">
                <div className="text-6xl mb-4">✈️</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
                <p className="text-gray-600 mb-6">
                  비행 일정을 관리하려면 로그인해주세요.<br />
                  로그인 후 개인별 비행 데이터를 안전하게 관리할 수 있습니다.
                </p>
                <button 
                  onClick={handleLoginClick}
                  className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors text-lg"
                >
                  로그인하기
                </button>
              </div>
            </div>
          </div>
        </div>

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
                <button 
                  onClick={handleUploadClick} 
                  disabled={isUploading} 
                  title="Upload Excel Schedule" 
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloudIcon className={`w-6 h-6 ${isUploading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                  onClick={handleUpdate} 
                  disabled={isUpdating} 
                  title="Refresh Data" 
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCwIcon className={`w-6 h-6 ${isUpdating ? 'animate-spin' : ''}`} />
                </button>
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