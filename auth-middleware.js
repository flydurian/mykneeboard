const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// JWT 시크릿 키 (환경변수에서 가져오거나 기본값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Passport Google OAuth 설정
function configurePassport(database) {
    // Google OAuth 환경변수가 없으면 데모 모드로 실행
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.log('⚠️ Google OAuth 설정이 없습니다. 데모 모드로 실행됩니다.');
        return;
    }

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await database.findOrCreateGoogleUser(profile);
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await database.getUserById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
}

// JWT 토큰 생성
function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            google_id: user.google_id,
            username: user.username,
            email: user.email,
            display_name: user.display_name
        },
        JWT_SECRET,
        { expiresIn: '7d' } // 7일간 유효
    );
}

// JWT 토큰 검증
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// 인증 미들웨어
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const user = verifyToken(token);
    if (!user) {
        return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }

    req.user = user;
    next();
}

// 세션 기반 인증 미들웨어 (Passport 사용) + JWT 토큰 백업
function authenticateSession(req, res, next) {
    // 세션 기반 인증 확인
    if (req.isAuthenticated()) {
        req.user = {
            id: req.user.id,
            google_id: req.user.google_id,
            username: req.user.username,
            email: req.user.email,
            display_name: req.user.display_name
        };
        return next();
    }

    // JWT 토큰 기반 인증 확인 (백업)
    const authToken = req.cookies.auth_token;
    if (authToken) {
        try {
            const user = verifyToken(authToken);
            if (user) {
                req.user = {
                    id: user.id,
                    google_id: user.google_id,
                    username: user.username,
                    email: user.email,
                    display_name: user.display_name
                };
                return next();
            }
        } catch (error) {
            console.error('JWT 토큰 검증 오류:', error);
        }
    }

    return res.status(401).json({ error: '로그인이 필요합니다.' });
}

// Google OAuth 인증 미들웨어
function authenticateGoogle(req, res, next) {
    passport.authenticate('google', { 
        scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'openid'] 
    })(req, res, next);
}

// Google OAuth 콜백 미들웨어
function authenticateGoogleCallback(req, res, next) {
    passport.authenticate('google', { 
        failureRedirect: '/login',
        failureFlash: true 
    }, async (err, user, info) => {
        console.log('Google OAuth 콜백 시작:', { err: !!err, user: !!user, info });
        
        if (err) {
            console.error('Google OAuth 콜백 오류:', err);
            return res.redirect('/login?error=auth_failed');
        }
        
        if (!user) {
            console.error('Google OAuth 사용자 정보 없음:', info);
            return res.redirect('/login?error=no_user');
        }

        try {
            console.log('사용자 정보 확인:', { 
                id: user.id, 
                email: user.email, 
                display_name: user.display_name 
            });
            
            // JWT 토큰 생성
            const token = generateToken(user);
            console.log('JWT 토큰 생성됨:', { 
                tokenLength: token ? token.length : 0,
                user: { id: user.id, email: user.email }
            });
            
            // 사용자 정보를 세션에 저장
            req.logIn(user, (err) => {
                if (err) {
                    console.error('세션 로그인 오류:', err);
                    return res.redirect('/login?error=session_failed');
                }
                console.log('세션 로그인 성공');
                
                // 세션을 명시적으로 저장
                req.session.save((err) => {
                    if (err) {
                        console.error('세션 저장 오류:', err);
                        return res.redirect('/login?error=session_save_failed');
                    }
                    console.log('세션 저장 완료');
                    
                    // JWT 토큰을 쿠키에 저장 (백업용)
                    res.cookie('auth_token', token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
                        sameSite: 'lax'
                    });
                    console.log('JWT 토큰 쿠키 설정 완료:', {
                        tokenLength: token ? token.length : 0,
                        secure: process.env.NODE_ENV === 'production',
                        domain: req.headers.host
                    });
                    
                    next();
                });
            });
        } catch (error) {
            console.error('Google OAuth 콜백 처리 오류:', error);
            return res.redirect('/login?error=processing_failed');
        }
    })(req, res, next);
}

module.exports = {
    configurePassport,
    generateToken,
    verifyToken,
    authenticateToken,
    authenticateSession,
    authenticateGoogle,
    authenticateGoogleCallback,
    JWT_SECRET
};
