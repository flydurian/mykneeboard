const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const xlsx = require('xlsx');
const TursoDatabase = require('./turso-db');
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

// Multer 설정 (파일 업로드)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB 제한
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xls', '.xlsx'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        
        if (allowedTypes.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('지원하지 않는 파일 형식입니다. .xls 또는 .xlsx 파일을 업로드해주세요.'));
        }
    }
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

// Excel 파일 업로드 API (인증 필요)
app.post('/api/upload-excel', authenticateSession, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
        }

        const { month } = req.body;
        const userId = req.user.id;

        if (!month || !['current', 'next'].includes(month)) {
            return res.status(400).json({ error: '유효한 월을 선택해주세요.' });
        }

        // Excel 파일 파싱
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length < 2) {
            return res.status(400).json({ error: '파일에 데이터가 없습니다.' });
        }

        // 헤더 추출
        const headers = data[0];
        const rows = data.slice(1);

        // 데이터 변환
        const flightData = rows.map(row => {
            const flight = {};
            headers.forEach((header, index) => {
                if (row[index] !== undefined) {
                    const key = header.toLowerCase().replace(/\s+/g, '_');
                    flight[key] = row[index];
                }
            });
            return flight;
        });

        // 월별 데이터 저장
        let targetMonth;
        let monthYear;
        
        if (month === 'next') {
            const now = new Date();
            targetMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            monthYear = targetMonth.toISOString().slice(0, 7);
        } else {
            const now = new Date();
            targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            monthYear = targetMonth.toISOString().slice(0, 7);
        }

        // 데이터베이스에 저장
        await tursoDb.saveFlightData(flightData, userId, monthYear);

        res.json({ 
            success: true, 
            message: `${monthYear} 데이터 업로드가 완료되었습니다. (${flightData.length}개 항공편)`,
            count: flightData.length
        });

    } catch (error) {
        console.error('Excel 파일 업로드 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '파일 업로드 중 오류가 발생했습니다: ' + error.message 
        });
    }
});

// 데이터 조회 API (인증 필요)
app.get('/api/flights/:monthYear', authenticateSession, async (req, res) => {
    try {
        const { monthYear } = req.params;
        const userId = req.user.id;
        
        const flights = await tursoDb.getFlightsByMonth(monthYear, userId);
        res.json({ success: true, data: flights });
    } catch (error) {
        console.error('항공편 조회 오류:', error);
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
