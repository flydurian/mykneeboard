const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const TursoDatabase = require('./turso-db');
const FlightScraper = require('./flight-scraper');
const { 
    configurePassport, 
    authenticateSession, 
    generateToken,
    authenticateGoogle,
    authenticateGoogleCallback
} = require('./auth-middleware');

const app = express();

// 전역 변수 초기화 (스크래핑 상태 관리)
global.scrapingStatus = {};
global.scrapingError = {};
global.demoScrapingStatus = {};

// Render 환경에서는 Turso 데이터베이스 사용
const tursoDb = new TursoDatabase();

// 데이터베이스 초기화
tursoDb.init().catch(error => {
    console.error('데이터베이스 초기화 오류:', error);
});

// Content Security Policy 헤더 설정
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com; frame-src 'self' https://accounts.google.com;"
    );
    next();
});

// Passport 설정
configurePassport(tursoDb);

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// 정적 파일 명시적 라우팅
app.get('/styles.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

app.get('/script.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'script.js'));
});

app.get('/login.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/favicon.ico', (req, res) => {
    res.setHeader('Content-Type', 'image/x-icon');
    res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
        httpOnly: true,
        sameSite: 'lax'
    },
    name: 'flight-dashboard-session'
}));

// Passport 초기화
app.use(passport.initialize());
app.use(passport.session());

// 메인 페이지
app.get('/', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 로그인 페이지
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 데모 로그인 페이지
app.get('/login-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login-demo.html'));
});

// 데모 메인 페이지
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// Google OAuth 로그인
app.get('/auth/google', authenticateGoogle);

// Google OAuth 콜백
app.get('/auth/google/callback', authenticateGoogleCallback, (req, res) => {
    try {
        // 성공적으로 로그인된 경우
        console.log('Google OAuth 로그인 성공:', req.user);
        console.log('세션 정보:', {
            sessionID: req.sessionID,
            isAuthenticated: req.isAuthenticated(),
            user: req.user
        });
        
        // 세션을 한 번 더 저장하여 확실히 보장
        req.session.save((err) => {
            if (err) {
                console.error('최종 세션 저장 오류:', err);
                return res.redirect('/login?error=final_session_save_failed');
            }
            console.log('최종 세션 저장 완료');
            console.log('리다이렉트 전 최종 상태:', {
                sessionID: req.sessionID,
                isAuthenticated: req.isAuthenticated(),
                user: req.user,
                cookies: req.headers.cookie ? 'present' : 'missing'
            });
            res.redirect('/');
        });
    } catch (error) {
        console.error('Google OAuth 콜백 리다이렉트 오류:', error);
        res.redirect('/login?error=redirect_failed');
    }
});

// 로그아웃
app.post('/api/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다.' });
        }
        res.json({ success: true, message: '로그아웃되었습니다.' });
    });
});

// 인증 상태 확인
app.get('/api/auth/status', (req, res) => {
    console.log('인증 상태 확인 요청:', {
        isAuthenticated: req.isAuthenticated(),
        sessionID: req.sessionID,
        user: req.user,
        cookies: req.headers.cookie ? 'present' : 'missing'
    });
    
    // 세션 기반 인증 확인
    if (req.isAuthenticated()) {
        res.json({ 
            isAuthenticated: true, 
            user: {
                id: req.user.id,
                google_id: req.user.google_id,
                username: req.user.username,
                email: req.user.email,
                display_name: req.user.display_name,
                profile_picture: req.user.profile_picture
            }
        });
        return;
    }
    
    // JWT 토큰 기반 인증 확인 (백업)
    const authToken = req.cookies.auth_token;
    if (authToken) {
        try {
            const user = require('./auth-middleware').verifyToken(authToken);
            if (user) {
                console.log('JWT 토큰으로 인증 성공:', user);
                res.json({ 
                    isAuthenticated: true, 
                    user: {
                        id: user.id,
                        google_id: user.google_id,
                        username: user.username,
                        email: user.email,
                        display_name: user.display_name,
                        profile_picture: user.profile_picture
                    }
                });
                return;
            }
        } catch (error) {
            console.error('JWT 토큰 검증 오류:', error);
        }
    }
    
    res.json({ isAuthenticated: false });
});

// 데이터 업데이트 시작 (인증 필요)
app.post('/api/update-data', authenticateSession, async (req, res) => {
    const { username, password, month } = req.body;
    const userId = req.user.id;
    
    if (!username || !password) {
        return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
    }

    if (!month || !['current', 'next'].includes(month)) {
        return res.status(400).json({ error: '유효한 월을 선택해주세요.' });
    }
    
    try {
        const scrapingId = Date.now().toString();
        
        const scraper = new FlightScraper(tursoDb);
        
        // Vercel에서는 백그라운드 작업이 제한되므로 즉시 실행
        scraper.scrapeAndSave({ username, password, month }, scrapingId, userId)
            .then(() => {
                console.log('스크래핑 완료');
            })
            .catch((error) => {
                console.error('스크래핑 오류:', error);
            });
        
        const monthText = month === 'current' ? '이번달' : '다음달';
        res.json({ 
            success: true, 
            message: `${monthText} 데이터 업데이트가 시작되었습니다.`,
            scrapingId: scrapingId
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 스크래핑 상태 확인 (인증 필요)
app.get('/api/update-status/:scrapingId', authenticateSession, async (req, res) => {
    const { scrapingId } = req.params;
    
    try {
        const statusData = await tursoDb.getScrapingStatus(scrapingId);
        res.json(statusData);
    } catch (error) {
        console.error('스크래핑 상태 조회 오류:', error);
        res.status(500).json({ status: 'error', error: '상태 조회 중 오류가 발생했습니다.' });
    }
});

// 데이터 조회 API (인증 필요)
app.get('/api/flights/:monthYear', authenticateSession, async (req, res) => {
    try {
        const { monthYear } = req.params;
        const userId = req.user.id;
        
        const flights = await tursoDb.getFlightsWithCrewByMonth(monthYear, userId);
        res.json({ success: true, data: flights });
    } catch (error) {
        console.error('항공편 조회 오류:', error);
        res.status(500).json({ success: false, error: '데이터 조회 중 오류가 발생했습니다.' });
    }
});

// Flight Crew 조회 API (인증 필요)
app.get('/api/flight-crew/:monthYear', authenticateSession, async (req, res) => {
    try {
        const { monthYear } = req.params;
        const userId = req.user.id;
        
        const flightCrew = await tursoDb.getFlightCrewByMonth(monthYear, userId);
        res.json({ success: true, data: flightCrew });
    } catch (error) {
        console.error('Flight Crew 조회 오류:', error);
        res.status(500).json({ success: false, error: '데이터 조회 중 오류가 발생했습니다.' });
    }
});

// Cabin Crew 조회 API (인증 필요)
app.get('/api/cabin-crew/:monthYear', authenticateSession, async (req, res) => {
    try {
        const { monthYear } = req.params;
        const userId = req.user.id;
        
        const cabinCrew = await tursoDb.getCabinCrewByMonth(monthYear, userId);
        res.json({ success: true, data: cabinCrew });
    } catch (error) {
        console.error('Cabin Crew 조회 오류:', error);
        res.status(500).json({ success: false, error: '데이터 조회 중 오류가 발생했습니다.' });
    }
});

// 월별 데이터 목록 조회 API (인증 필요)
app.get('/api/months', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.id;
        const months = await tursoDb.getAllMonths(userId);
        res.json({ success: true, data: months });
    } catch (error) {
        console.error('월 목록 조회 오류:', error);
        res.status(500).json({ success: false, error: '월 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 통계 조회 API (인증 필요)
app.get('/api/stats', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await tursoDb.getFlightStats(userId);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('통계 조회 오류:', error);
        res.status(500).json({ success: false, error: '통계 조회 중 오류가 발생했습니다.' });
    }
});

// 데이터 내보내기 API (인증 필요)
app.get('/api/export-data', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.id;
        const exportData = await tursoDb.exportAllData(userId);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="flight-data-${new Date().toISOString().slice(0, 10)}.json"`);
        res.json(exportData);
    } catch (error) {
        console.error('데이터 내보내기 오류:', error);
        res.status(500).json({ success: false, error: '데이터 내보내기 중 오류가 발생했습니다.' });
    }
});

// 사용자 정보 조회 (인증 필요)
app.get('/api/user/profile', authenticateSession, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await tursoDb.getUserById(userId);
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 헬스체크 엔드포인트
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Render 환경에서는 서버 시작, Vercel에서는 모듈만 export
if (process.env.VERCEL) {
    module.exports = app;
} else {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
        console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
        if (process.env.RENDER) {
            console.log('Render 환경에서 실행 중입니다.');
        } else {
            console.log(`데모 프리뷰: http://localhost:${PORT}/login-demo`);
            console.log(`실제 로그인: http://localhost:${PORT}/login`);
        }
    });
}
