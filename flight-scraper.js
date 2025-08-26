const puppeteer = require('puppeteer');
const TursoDatabase = require('./turso-db');

class FlightScraper {
    constructor(database) {
        this.database = database;
    }

    async scrapeAndSave(credentials, scrapingId, userId) {
        const { username, password, month } = credentials;
        
        // Render 환경에서는 실제 스크래핑 실행
        if (process.env.RENDER || process.env.NODE_ENV === 'production') {
            console.log('Render 환경에서 실행 중. 실제 스크래핑을 수행합니다.');
            
            try {
                global.scrapingStatus[scrapingId] = 'starting';
                
                const browser = await puppeteer.launch({
                    headless: true,
                    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--single-process',
                        '--disable-extensions'
                    ]
                });
                
                const page = await browser.newPage();
                
                // 크루월드 로그인 페이지로 이동
                console.log('크루월드 로그인 페이지에 접속 중...');
                global.scrapingStatus[scrapingId] = 'connecting';
                
                await page.goto('https://creworld.flyasiana.com', {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                
                // 로그인 처리
                const loginSuccess = await this.handleLogin(page, username, password);
                if (!loginSuccess) {
                    global.scrapingStatus[scrapingId] = 'error';
                    global.scrapingError[scrapingId] = '로그인에 실패했습니다.';
                    await browser.close();
                    return;
                }
                
                global.scrapingStatus[scrapingId] = 'scraping';
                
                // 선택된 월에 따라 스크래핑
                let targetMonth;
                let monthYear;
                
                if (month === 'next') {
                    // 다음달 계산
                    const now = new Date();
                    targetMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    monthYear = targetMonth.toISOString().slice(0, 7); // YYYY-MM
                } else {
                    // 이번달
                    const now = new Date();
                    targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    monthYear = targetMonth.toISOString().slice(0, 7); // YYYY-MM
                }
                
                console.log(`스크래핑 대상 월: ${monthYear}`);
                
                // 항공편 데이터 스크래핑
                const flightData = await this.scrapeFlightData(page, monthYear);
                
                global.scrapingStatus[scrapingId] = 'saving';
                
                // 데이터베이스에 월별로 저장
                await this.database.saveFlightData(flightData, userId, monthYear);
                
                global.scrapingStatus[scrapingId] = 'completed';
                
                await browser.close();
                
            } catch (error) {
                console.error('스크래핑 오류:', error);
                global.scrapingStatus[scrapingId] = 'error';
                global.scrapingError[scrapingId] = error.message;
            }
        } else {
            // 로컬 개발 환경에서는 데모 모드
            console.log('로컬 환경에서 실행 중. 데모 모드로 스크래핑을 시뮬레이션합니다.');
            
            // 스크래핑 상태를 데이터베이스에 저장
            await this.database.updateScrapingStatus(scrapingId, 'starting');
            
            // 데모 데이터 생성
            const demoFlightData = this.generateDemoFlightData(month);
            
            await this.database.updateScrapingStatus(scrapingId, 'saving');
            await this.database.saveFlightData(demoFlightData, userId, month);
            await this.database.updateScrapingStatus(scrapingId, 'completed');
            
            return;
        }
        

    }

    async handleLogin(page, username, password) {
        try {
            // 로그인 폼 요소들을 찾아서 입력
            await page.waitForSelector('input[type="text"], input[name="username"], #username, .username, input[placeholder*="사용자명"], input[placeholder*="아이디"]', { timeout: 10000 });
            
            // 사용자명 입력
            await page.type('input[type="text"], input[name="username"], #username, .username, input[placeholder*="사용자명"], input[placeholder*="아이디"]', username);
            
            // 비밀번호 입력
            await page.type('input[type="password"], input[name="password"], #password, .password, input[placeholder*="비밀번호"]', password);
            
            // 로그인 버튼 클릭
            await page.click('input[type="submit"], button[type="submit"], .login-btn, .btn-login, button:contains("로그인")');
            
            // 로그인 후 페이지 로딩 대기
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
            
            console.log('크루월드 로그인 완료');
            return true;
            
        } catch (error) {
            console.log('로그인 처리 중 오류:', error.message);
            return false;
        }
    }

    async scrapeFlightData(page, monthYear) {
        try {
            console.log('항공편 데이터 스크래핑 시작...');
            
            // 스케줄 페이지로 이동
            await page.goto('https://creworld.flyasiana.com/crw/websquare/websquare.html?w2xPath=/crw/ux/crew/main/main.xml&topMenuId=FSKD00&subMenuId=FSKD0003', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // 월 선택
            await this.selectMonth(page, monthYear);
            
            // 항공편 목록 대기
            await page.waitForSelector('.flight-row, .schedule-row, [data-flight]', { timeout: 10000 });
            
            // 항공편 데이터 수집
            const flightData = await page.evaluate(() => {
                const flights = [];
                const flightRows = document.querySelectorAll('.flight-row, .schedule-row, [data-flight]');
                
                flightRows.forEach((row, index) => {
                    try {
                        // 기본 항공편 정보 추출
                        const flightNumber = row.querySelector('.flight-number, .flight-num')?.textContent?.trim() || 
                                           row.getAttribute('data-flight') || 
                                           `FLIGHT-${index + 1}`;
                        
                        const stdElement = row.querySelector('.std, .departure-time, .time-depart');
                        const staElement = row.querySelector('.sta, .arrival-time, .time-arrive');
                        
                        const std = stdElement?.textContent?.trim() || '';
                        const sta = staElement?.textContent?.trim() || '';
                        
                        const departureElement = row.querySelector('.departure, .departure-airport, .airport-depart');
                        const arrivalElement = row.querySelector('.arrival, .arrival-airport, .airport-arrive');
                        
                        const departure_airport = departureElement?.textContent?.trim() || '';
                        const arrival_airport = arrivalElement?.textContent?.trim() || '';
                        
                        const hlnoElement = row.querySelector('.hlno, .aircraft, .ac-reg');
                        const hlno = hlnoElement?.textContent?.trim() || '';
                        
                        flights.push({
                            flightNumber,
                            std,
                            sta,
                            departure_airport,
                            arrival_airport,
                            hlno,
                            flightCrew: [],
                            cabinCrew: []
                        });
                    } catch (error) {
                        console.error('항공편 데이터 추출 오류:', error);
                    }
                });
                
                return flights;
            });
            
            console.log(`${flightData.length}개 항공편 기본 정보 수집 완료`);
            
            // 각 항공편에 대해 크루 정보 수집
            for (let i = 0; i < flightData.length; i++) {
                const flight = flightData[i];
                console.log(`${i + 1}/${flightData.length} 항공편 크루 정보 수집 중: ${flight.flightNumber}`);
                
                try {
                    // 항공편 상세 정보 페이지로 이동 (가능한 경우)
                    const detailLink = await page.$(`[data-flight="${flight.flightNumber}"], .flight-row:nth-child(${i + 1}) a, .schedule-row:nth-child(${i + 1}) a`);
                    
                    if (detailLink) {
                        await detailLink.click();
                        await page.waitForTimeout(2000);
                        
                        // Flight Crew 정보 수집
                        const flightCrew = await page.evaluate(() => {
                            const crewMembers = [];
                            const crewRows = document.querySelectorAll('.flight-crew-row, .pilot-row, .crew-flight');
                            
                            crewRows.forEach(row => {
                                const name = row.querySelector('.crew-name, .pilot-name, .name')?.textContent?.trim() || '';
                                const position = row.querySelector('.crew-position, .pilot-position, .position')?.textContent?.trim() || '';
                                const rank = row.querySelector('.crew-rank, .pilot-rank, .rank')?.textContent?.trim() || '';
                                const employeeId = row.querySelector('.crew-id, .pilot-id, .employee-id')?.textContent?.trim() || '';
                                
                                if (name) {
                                    crewMembers.push({ name, position, rank, employeeId });
                                }
                            });
                            
                            return crewMembers;
                        });
                        
                        flight.flightCrew = flightCrew;
                        
                        // Cabin Crew 정보 수집
                        const cabinCrew = await page.evaluate(() => {
                            const crewMembers = [];
                            const crewRows = document.querySelectorAll('.cabin-crew-row, .attendant-row, .crew-cabin');
                            
                            crewRows.forEach(row => {
                                const name = row.querySelector('.crew-name, .attendant-name, .name')?.textContent?.trim() || '';
                                const position = row.querySelector('.crew-position, .attendant-position, .position')?.textContent?.trim() || '';
                                const rank = row.querySelector('.crew-rank, .attendant-rank, .rank')?.textContent?.trim() || '';
                                const employeeId = row.querySelector('.crew-id, .attendant-id, .employee-id')?.textContent?.trim() || '';
                                
                                if (name) {
                                    crewMembers.push({ name, position, rank, employeeId });
                                }
                            });
                            
                            return crewMembers;
                        });
                        
                        flight.cabinCrew = cabinCrew;
                        
                        // 뒤로 가기
                        await page.goBack();
                        await page.waitForTimeout(1000);
                    }
                } catch (error) {
                    console.error(`${flight.flightNumber} 크루 정보 수집 오류:`, error);
                }
            }
            
            console.log('항공편 데이터 스크래핑 완료');
            return flightData;
            
        } catch (error) {
            console.error('항공편 데이터 스크래핑 오류:', error);
            throw error;
        }
    }

    async selectMonth(page, monthYear) {
        try {
            // 월 선택 드롭다운이나 버튼을 찾아서 선택
            const monthSelector = await page.$('select[name="month"], .month-select, #monthSelect');
            if (monthSelector) {
                await monthSelector.select(monthYear);
                await page.waitForTimeout(2000);
            }
        } catch (error) {
            console.log('월 선택 중 오류 (무시됨):', error.message);
        }
    }

    generateDemoFlightData(month) {
        const now = new Date();
        let targetMonth;
        
        if (month === 'next') {
            targetMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        } else {
            targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const monthYear = targetMonth.toISOString().slice(0, 7);
        
        return [
            {
                flightNumber: 'OZ123',
                std: '08:00',
                sta: '10:30',
                departureAirport: 'ICN',
                arrivalAirport: 'NRT',
                hlno: 'HL1234',
                flightCrew: [
                    { name: '김기장', position: '기장', rank: '선임기장', employeeId: 'P001' },
                    { name: '이부기장', position: '부기장', rank: '부기장', employeeId: 'P002' }
                ],
                cabinCrew: [
                    { name: '박승무원', position: '승무원', rank: '선임승무원', employeeId: 'C001' },
                    { name: '최승무원', position: '승무원', rank: '승무원', employeeId: 'C002' }
                ]
            },
            {
                flightNumber: 'OZ456',
                std: '14:00',
                sta: '16:30',
                departureAirport: 'ICN',
                arrivalAirport: 'LAX',
                hlno: 'HL5678',
                flightCrew: [
                    { name: '정기장', position: '기장', rank: '기장', employeeId: 'P003' },
                    { name: '한부기장', position: '부기장', rank: '부기장', employeeId: 'P004' }
                ],
                cabinCrew: [
                    { name: '임승무원', position: '승무원', rank: '선임승무원', employeeId: 'C003' },
                    { name: '강승무원', position: '승무원', rank: '승무원', employeeId: 'C004' }
                ]
            }
        ];
    }
}

module.exports = FlightScraper;
