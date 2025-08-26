const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

class TursoDatabase {
    constructor() {
        this.isDemoMode = !process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN;
        
        if (this.isDemoMode) {
            console.log('⚠️ Turso 데이터베이스 설정이 없습니다. 데모 모드로 실행됩니다.');
            console.log('환경변수 확인:');
            console.log('- TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? '설정됨' : '설정되지 않음');
            console.log('- TURSO_AUTH_TOKEN:', process.env.TURSO_AUTH_TOKEN ? '설정됨' : '설정되지 않음');
            return;
        }

        try {
            this.client = createClient({
                url: process.env.TURSO_DATABASE_URL,
                authToken: process.env.TURSO_AUTH_TOKEN
            });
            console.log('✅ Turso 데이터베이스 연결 성공');
            
        } catch (error) {
            console.error('❌ Turso 데이터베이스 연결 오류:', error);
            this.isDemoMode = true;
        }
    }

    async init() {
        if (this.isDemoMode) {
            console.log('데모 모드: 데이터베이스 초기화 건너뜀');
            return;
        }

        // 테이블 초기화
        await this.initializeTables();
    }



    async initializeTables() {
        if (this.isDemoMode) {
            console.log('데모 모드: 테이블 초기화 건너뜀');
            return;
        }

        try {
            // 사용자 테이블
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    google_id TEXT UNIQUE,
                    display_name TEXT,
                    profile_picture TEXT,
                    email TEXT UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME
                )
            `);

            // 항공편 정보 테이블
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS flights (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    flight_number TEXT NOT NULL,
                    std TEXT,
                    sta TEXT,
                    departure_airport TEXT,
                    arrival_airport TEXT,
                    hlno TEXT,
                    month_year TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

            // Flight Crew List 테이블
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS flight_crew (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    flight_id INTEGER NOT NULL,
                    crew_member_name TEXT NOT NULL,
                    crew_position TEXT,
                    crew_rank TEXT,
                    crew_employee_id TEXT,
                    month_year TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

            // Cabin Crew List 테이블
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS cabin_crew (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    flight_id INTEGER NOT NULL,
                    crew_member_name TEXT NOT NULL,
                    crew_position TEXT,
                    crew_rank TEXT,
                    crew_employee_id TEXT,
                    month_year TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

            // 인덱스 생성
            await this.client.execute(`
                CREATE INDEX IF NOT EXISTS idx_flights_user_month 
                ON flights(user_id, month_year)
            `);
            
            await this.client.execute(`
                CREATE INDEX IF NOT EXISTS idx_flight_crew_user_month 
                ON flight_crew(user_id, month_year)
            `);
            
            await this.client.execute(`
                CREATE INDEX IF NOT EXISTS idx_cabin_crew_user_month 
                ON cabin_crew(user_id, month_year)
            `);

            // 스크래핑 상태 테이블
            await this.client.execute(`
                CREATE TABLE IF NOT EXISTS scraping_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scraping_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    error TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await this.client.execute(`
                CREATE INDEX IF NOT EXISTS idx_scraping_status_id 
                ON scraping_status(scraping_id)
            `);

            // 기존 데이터베이스에 last_login 컬럼이 없으면 추가
            try {
                await this.client.execute(`
                    ALTER TABLE users ADD COLUMN last_login DATETIME
                `);
                console.log('last_login 컬럼 추가 완료');
            } catch (error) {
                // 컬럼이 이미 존재하는 경우 무시
                if (!error.message.includes('duplicate column name')) {
                    console.log('last_login 컬럼이 이미 존재합니다');
                }
            }

            console.log('데이터베이스 테이블 초기화 완료');
        } catch (error) {
            console.error('테이블 초기화 오류:', error);
            throw error;
        }
    }

    // Google OAuth 사용자 찾기 또는 생성
    async findOrCreateGoogleUser(profile) {
        if (this.isDemoMode) {
            console.log('데모 모드: Google 사용자 생성 건너뜀');
            return {
                id: 1,
                google_id: profile.id,
                username: profile.emails[0].value.split('@')[0],
                email: profile.emails[0].value,
                display_name: profile.displayName,
                profile_picture: profile.photos[0]?.value,
                created_at: new Date().toISOString()
            };
        }

        try {
            // 기존 사용자 찾기
            const existingUser = await this.client.execute({
                sql: 'SELECT * FROM users WHERE google_id = ? OR email = ?',
                args: [profile.id, profile.emails[0].value]
            });

            if (existingUser.rows.length > 0) {
                const user = existingUser.rows[0];
                
                // Google ID가 없으면 업데이트
                if (!user.google_id) {
                    try {
                        await this.client.execute({
                            sql: 'UPDATE users SET google_id = ?, display_name = ?, profile_picture = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
                            args: [profile.id, profile.displayName, profile.photos[0]?.value, user.id]
                        });
                    } catch (error) {
                        // last_login 컬럼이 없는 경우 해당 컬럼 없이 업데이트
                        if (error.message.includes('no such column: last_login')) {
                            await this.client.execute({
                                sql: 'UPDATE users SET google_id = ?, display_name = ?, profile_picture = ? WHERE id = ?',
                                args: [profile.id, profile.displayName, profile.photos[0]?.value, user.id]
                            });
                        } else {
                            throw error;
                        }
                    }
                } else {
                    // 마지막 로그인 시간 업데이트
                    try {
                        await this.client.execute({
                            sql: 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                            args: [user.id]
                        });
                    } catch (error) {
                        // last_login 컬럼이 없는 경우 무시
                        if (!error.message.includes('no such column: last_login')) {
                            throw error;
                        }
                    }
                }

                return {
                    id: user.id,
                    google_id: user.google_id || profile.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.display_name || profile.displayName,
                    profile_picture: user.profile_picture || profile.photos[0]?.value,
                    created_at: user.created_at
                };
            }

            // 새 사용자 생성
            let newUser;
            try {
                newUser = await this.client.execute({
                    sql: `
                        INSERT INTO users (google_id, username, email, display_name, profile_picture, last_login)
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `,
                    args: [
                        profile.id,
                        profile.emails[0].value.split('@')[0], // 이메일에서 사용자명 추출
                        profile.emails[0].value,
                        profile.displayName,
                        profile.photos[0]?.value
                    ]
                });
            } catch (error) {
                // last_login 컬럼이 없는 경우 해당 컬럼 없이 삽입
                if (error.message.includes('no such column: last_login')) {
                    newUser = await this.client.execute({
                        sql: `
                            INSERT INTO users (google_id, username, email, display_name, profile_picture)
                            VALUES (?, ?, ?, ?, ?)
                        `,
                        args: [
                            profile.id,
                            profile.emails[0].value.split('@')[0], // 이메일에서 사용자명 추출
                            profile.emails[0].value,
                            profile.displayName,
                            profile.photos[0]?.value
                        ]
                    });
                } else {
                    throw error;
                }
            }

            return {
                id: newUser.lastInsertRowid,
                google_id: profile.id,
                username: profile.emails[0].value.split('@')[0],
                email: profile.emails[0].value,
                display_name: profile.displayName,
                profile_picture: profile.photos[0]?.value,
                created_at: new Date().toISOString()
            };

        } catch (error) {
            console.error('Google 사용자 생성/찾기 오류:', error);
            throw error;
        }
    }

    // 사용자 정보 조회
    async getUserById(userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: 사용자 조회 건너뜀');
            return {
                id: userId,
                google_id: 'demo_google_id',
                username: 'demo_user',
                email: 'demo@example.com',
                display_name: '데모 사용자',
                profile_picture: null,
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
            };
        }

        try {
            const result = await this.client.execute({
                sql: 'SELECT id, google_id, username, email, display_name, profile_picture, created_at, last_login FROM users WHERE id = ?',
                args: [userId]
            });

            return result.rows[0] || null;
        } catch (error) {
            // last_login 컬럼이 없는 경우 해당 컬럼 없이 조회
            if (error.message.includes('no such column: last_login')) {
                const result = await this.client.execute({
                    sql: 'SELECT id, google_id, username, email, display_name, profile_picture, created_at FROM users WHERE id = ?',
                    args: [userId]
                });
                return result.rows[0] || null;
            }
            console.error('사용자 조회 오류:', error);
            throw error;
        }
    }

    // Google ID로 사용자 조회
    async getUserByGoogleId(googleId) {
        if (this.isDemoMode) {
            console.log('데모 모드: Google ID로 사용자 조회 건너뜀');
            return null;
        }

        try {
            const result = await this.client.execute({
                sql: 'SELECT id, google_id, username, email, display_name, profile_picture, created_at, last_login FROM users WHERE google_id = ?',
                args: [googleId]
            });

            return result.rows[0] || null;
        } catch (error) {
            // last_login 컬럼이 없는 경우 해당 컬럼 없이 조회
            if (error.message.includes('no such column: last_login')) {
                const result = await this.client.execute({
                    sql: 'SELECT id, google_id, username, email, display_name, profile_picture, created_at FROM users WHERE google_id = ?',
                    args: [googleId]
                });
                return result.rows[0] || null;
            }
            console.error('Google ID로 사용자 조회 오류:', error);
            throw error;
        }
    }

    async saveFlightData(flightData, userId, monthYear = null) {
        if (this.isDemoMode) {
            console.log('데모 모드: 데이터 저장 건너뜀');
            return;
        }

        // monthYear가 없으면 현재 월 사용
        if (!monthYear) {
            monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
        }
        
        try {
            // 기존 월 데이터 삭제 (해당 사용자의 데이터만)
            await this.client.execute({
                sql: 'DELETE FROM cabin_crew WHERE month_year = ? AND user_id = ?',
                args: [monthYear, userId]
            });
            
            await this.client.execute({
                sql: 'DELETE FROM flight_crew WHERE month_year = ? AND user_id = ?',
                args: [monthYear, userId]
            });
            
            await this.client.execute({
                sql: 'DELETE FROM flights WHERE month_year = ? AND user_id = ?',
                args: [monthYear, userId]
            });

            console.log(`${monthYear} 월의 기존 데이터 삭제 완료 (사용자 ID: ${userId})`);

            // 새 데이터 삽입
            for (const flight of flightData) {
                // 항공편 정보 저장
                const flightResult = await this.client.execute({
                    sql: `
                        INSERT INTO flights 
                        (flight_number, std, sta, departure_airport, arrival_airport, hlno, month_year, user_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        flight.flightNumber,
                        flight.std,
                        flight.sta,
                        flight.departure_airport,
                        flight.arrival_airport,
                        flight.hlno,
                        monthYear,
                        userId
                    ]
                });
                
                const flightId = flightResult.lastInsertRowid;
                
                // Flight Crew List 저장
                if (flight.flightCrew && flight.flightCrew.length > 0) {
                    for (const crewMember of flight.flightCrew) {
                        await this.client.execute({
                            sql: `
                                INSERT INTO flight_crew 
                                (flight_id, crew_member_name, crew_position, crew_rank, crew_employee_id, month_year, user_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `,
                            args: [
                                flightId,
                                crewMember.name || '',
                                crewMember.position || '',
                                crewMember.rank || '',
                                crewMember.employeeId || '',
                                monthYear,
                                userId
                            ]
                        });
                    }
                }
                
                // Cabin Crew List 저장
                if (flight.cabinCrew && flight.cabinCrew.length > 0) {
                    for (const crewMember of flight.cabinCrew) {
                        await this.client.execute({
                            sql: `
                                INSERT INTO cabin_crew 
                                (flight_id, crew_member_name, crew_position, crew_rank, crew_employee_id, month_year, user_id)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `,
                            args: [
                                flightId,
                                crewMember.name || '',
                                crewMember.position || '',
                                crewMember.rank || '',
                                crewMember.employeeId || '',
                                monthYear,
                                userId
                            ]
                        });
                    }
                }
            }

            console.log(`${flightData.length}개 항공편 데이터 저장 완료 (월: ${monthYear}, 사용자 ID: ${userId})`);
            
        } catch (error) {
            console.error('데이터 저장 오류:', error);
            throw error;
        }
    }

    async getFlightsByMonth(monthYear, userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: 항공편 조회 건너뜀');
            return [];
        }

        try {
            const result = await this.client.execute({
                sql: `
                    SELECT * FROM flights 
                    WHERE month_year = ? AND user_id = ?
                    ORDER BY flight_number, std
                `,
                args: [monthYear, userId]
            });
            
            console.log(`${monthYear} 월 데이터 조회 완료: ${result.rows.length}개 항공편`);
            return result.rows;
        } catch (error) {
            console.error('데이터 조회 오류:', error);
            throw error;
        }
    }

    async getAllMonths(userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: 월 목록 조회 건너뜀');
            return [];
        }

        try {
            const result = await this.client.execute({
                sql: `
                    SELECT DISTINCT month_year 
                    FROM flights 
                    WHERE user_id = ?
                    ORDER BY month_year DESC
                `,
                args: [userId]
            });
            
            const months = result.rows.map(row => row.month_year);
            console.log(`사용자 ${userId}의 저장된 월 목록: ${months.join(', ')}`);
            return months;
        } catch (error) {
            console.error('월 목록 조회 오류:', error);
            throw error;
        }
    }

    async getFlightStats(userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: 통계 조회 건너뜀');
            return {
                total_flights: 0,
                total_months: 0,
                latest_month: null
            };
        }

        try {
            const result = await this.client.execute({
                sql: `
                    SELECT 
                        COUNT(*) as total_flights,
                        COUNT(DISTINCT month_year) as total_months,
                        MAX(month_year) as latest_month
                    FROM flights
                    WHERE user_id = ?
                `,
                args: [userId]
            });
            
            const stats = result.rows[0];
            console.log(`사용자 ${userId} 통계: 총 ${stats.total_flights}개 항공편, ${stats.total_months}개월`);
            return stats;
        } catch (error) {
            console.error('통계 조회 오류:', error);
            throw error;
        }
    }

    // 전체 데이터를 JSON으로 내보내기 (사용자별)
    async exportAllData(userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: 데이터 내보내기 건너뜀');
            return {
                flights: [],
                crewMembers: [],
                flightCrew: [],
                exportDate: new Date().toISOString(),
                totalFlights: 0,
                totalCrewMembers: 0,
                months: []
            };
        }

        try {
            const flights = await this.client.execute({
                sql: 'SELECT * FROM flights WHERE user_id = ? ORDER BY month_year DESC, flight_number, std',
                args: [userId]
            });

            const crewMembers = await this.client.execute({
                sql: 'SELECT * FROM crew_members WHERE user_id = ? ORDER BY month_year DESC, created_at DESC',
                args: [userId]
            });

            const flightCrew = await this.client.execute({
                sql: 'SELECT * FROM flight_crew WHERE user_id = ? ORDER BY created_at DESC',
                args: [userId]
            });

            // 월별 통계
            const monthStats = await this.client.execute({
                sql: `
                    SELECT month_year, COUNT(*) as flight_count
                    FROM flights 
                    WHERE user_id = ?
                    GROUP BY month_year
                    ORDER BY month_year DESC
                `,
                args: [userId]
            });

            return {
                flights: flights.rows,
                crewMembers: crewMembers.rows,
                flightCrew: flightCrew.rows,
                monthStats: monthStats.rows,
                exportDate: new Date().toISOString(),
                totalFlights: flights.rows.length,
                totalCrewMembers: crewMembers.rows.length,
                months: monthStats.rows.map(row => row.month_year)
            };
        } catch (error) {
            console.error('데이터 내보내기 오류:', error);
            throw error;
        }
    }

    async getFlightsWithCrewByMonth(monthYear, userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: 항공편 및 크루 조회 건너뜀');
            return [];
        }

        try {
            // 항공편 정보 조회
            const flightsResult = await this.client.execute({
                sql: `
                    SELECT * FROM flights 
                    WHERE month_year = ? AND user_id = ?
                    ORDER BY flight_number, std
                `,
                args: [monthYear, userId]
            });
            
            const flights = flightsResult.rows;
            const flightsWithCrew = [];
            
            // 각 항공편에 대해 크루 정보 조회
            for (const flight of flights) {
                // Flight Crew 조회
                const flightCrewResult = await this.client.execute({
                    sql: `
                        SELECT * FROM flight_crew 
                        WHERE flight_id = ? AND user_id = ?
                        ORDER BY crew_member_name
                    `,
                    args: [flight.id, userId]
                });
                
                // Cabin Crew 조회
                const cabinCrewResult = await this.client.execute({
                    sql: `
                        SELECT * FROM cabin_crew 
                        WHERE flight_id = ? AND user_id = ?
                        ORDER BY crew_member_name
                    `,
                    args: [flight.id, userId]
                });
                
                flightsWithCrew.push({
                    ...flight,
                    flightCrew: flightCrewResult.rows,
                    cabinCrew: cabinCrewResult.rows
                });
            }
            
            console.log(`${monthYear} 월 데이터 조회 완료: ${flightsWithCrew.length}개 항공편 (크루 정보 포함)`);
            return flightsWithCrew;
        } catch (error) {
            console.error('데이터 조회 오류:', error);
            throw error;
        }
    }

    async getFlightCrewByMonth(monthYear, userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: Flight Crew 조회 건너뜀');
            return [];
        }

        try {
            const result = await this.client.execute({
                sql: `
                    SELECT fc.*, f.flight_number, f.std, f.sta
                    FROM flight_crew fc
                    JOIN flights f ON fc.flight_id = f.id
                    WHERE fc.month_year = ? AND fc.user_id = ?
                    ORDER BY f.flight_number, fc.crew_member_name
                `,
                args: [monthYear, userId]
            });
            
            console.log(`${monthYear} 월 Flight Crew 조회 완료: ${result.rows.length}명`);
            return result.rows;
        } catch (error) {
            console.error('Flight Crew 조회 오류:', error);
            throw error;
        }
    }

    async getCabinCrewByMonth(monthYear, userId) {
        if (this.isDemoMode) {
            console.log('데모 모드: Cabin Crew 조회 건너뜀');
            return [];
        }

        try {
            const result = await this.client.execute({
                sql: `
                    SELECT cc.*, f.flight_number, f.std, f.sta
                    FROM cabin_crew cc
                    JOIN flights f ON cc.flight_id = f.id
                    WHERE cc.month_year = ? AND cc.user_id = ?
                    ORDER BY f.flight_number, cc.crew_member_name
                `,
                args: [monthYear, userId]
            });
            
            console.log(`${monthYear} 월 Cabin Crew 조회 완료: ${result.rows.length}명`);
            return result.rows;
        } catch (error) {
            console.error('Cabin Crew 조회 오류:', error);
            throw error;
        }
    }

    // 스크래핑 상태 관리 메서드들
    async updateScrapingStatus(scrapingId, status, error = null) {
        if (this.isDemoMode) {
            console.log(`데모 모드: 스크래핑 상태 업데이트 - ${scrapingId}: ${status}`);
            // 데모 모드에서는 메모리에 상태 저장
            if (!global.demoScrapingStatus) {
                global.demoScrapingStatus = {};
            }
            global.demoScrapingStatus[scrapingId] = { status, error };
            return;
        }

        try {
            await this.client.execute({
                sql: `
                    INSERT OR REPLACE INTO scraping_status (scraping_id, status, error, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                `,
                args: [scrapingId, status, error]
            });
            console.log(`스크래핑 상태 업데이트: ${scrapingId} -> ${status}`);
        } catch (error) {
            console.error('스크래핑 상태 업데이트 오류:', error);
            throw error;
        }
    }

    async getScrapingStatus(scrapingId) {
        if (this.isDemoMode) {
            console.log(`데모 모드: 스크래핑 상태 조회 - ${scrapingId}`);
            // 데모 모드에서는 메모리에서 상태 조회
            if (global.demoScrapingStatus && global.demoScrapingStatus[scrapingId]) {
                return global.demoScrapingStatus[scrapingId];
            }
            return { status: 'idle', error: null };
        }

        try {
            const result = await this.client.execute({
                sql: `
                    SELECT status, error FROM scraping_status 
                    WHERE scraping_id = ?
                    ORDER BY updated_at DESC 
                    LIMIT 1
                `,
                args: [scrapingId]
            });
            
            if (result.rows.length > 0) {
                return {
                    status: result.rows[0].status,
                    error: result.rows[0].error
                };
            }
            
            return { status: 'idle', error: null };
        } catch (error) {
            console.error('스크래핑 상태 조회 오류:', error);
            return { status: 'error', error: error.message };
        }
    }
}

module.exports = TursoDatabase;
