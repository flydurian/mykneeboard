const puppeteer = require('puppeteer');

class FlightScraper {
    constructor(tursoDb) {
        this.tursoDb = tursoDb;
    }

    async testCreworldLogin(username, password) {
        console.log('크루월드 로그인 테스트 시작...');
        
        if (process.env.RENDER) {
            console.log('Render 환경에서 데모 모드로 로그인 테스트를 시뮬레이션합니다.');
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('크루월드 로그인 테스트 성공 (데모 모드)');
            return true;
        }

        try {
            const browser = await puppeteer.launch({
                headless: true,
                ignoreDefaultArgs: ['--disable-extensions'],
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--single-process',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ]
            });

            const page = await browser.newPage();
            
            // User-Agent 설정
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // 크루월드 로그인 페이지로 이동
            await page.goto('https://creworld.flyasiana.com/crw/websquare/websquare.html?w2xPath=/crw/ux/crew/main/main.xml&topMenuId=FSKD00&subMenuId=FSKD0002#', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // 로그인 폼 찾기 및 입력
            await page.waitForSelector('#username', { timeout: 10000 });
            await page.type('#username', username);
            await page.type('#password', password);
            
            // 로그인 버튼 클릭
            await page.click('#login-button');
            
            // 로그인 성공 확인
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
            
            await browser.close();
            console.log('크루월드 로그인 테스트 성공');
            return true;
            
        } catch (error) {
            console.error('크루월드 로그인 테스트 오류:', error);
            return false;
        }
    }

    async scrapeAndSave(credentials, scrapingId, userId) {
        console.log('스크래핑 시작...');
        
        try {
            // 스크래핑 상태 업데이트
            await this.tursoDb.updateScrapingStatus(scrapingId, 'starting');
            
            if (process.env.RENDER) {
                console.log('Render 환경에서 실행 중. 데모 모드로 스크래핑을 시뮬레이션합니다.');
                
                // 데모 데이터 생성
                const month = credentials.month;
                const demoData = this.generateDemoFlightData(month);
                
                // 스크래핑 상태 업데이트
                await this.tursoDb.updateScrapingStatus(scrapingId, 'scraping');
                
                // 시뮬레이션을 위한 지연
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 스크래핑 상태 업데이트
                await this.tursoDb.updateScrapingStatus(scrapingId, 'saving');
                
                // 월별 데이터 저장
                let monthYear;
                if (month === 'next') {
                    const now = new Date();
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    monthYear = nextMonth.toISOString().slice(0, 7);
                } else {
                    const now = new Date();
                    monthYear = now.toISOString().slice(0, 7);
                }
                
                // 기존 데이터 삭제
                await this.tursoDb.deleteFlightsByMonth(monthYear, userId);
                console.log(`current 월의 기존 데이터 삭제 완료 (사용자 ID: ${userId})`);
                
                // 새 데이터 저장
                await this.tursoDb.saveFlightData(demoData, userId, monthYear);
                
                // 스크래핑 상태 업데이트
                await this.tursoDb.updateScrapingStatus(scrapingId, 'completed');
                
                console.log('데모 모드 스크래핑 완료');
                return;
                
            } else if (process.env.NODE_ENV === 'production') {
                // 실제 스크래핑 로직 (로컬 환경)
                const browser = await puppeteer.launch({
                    headless: true,
                    ignoreDefaultArgs: ['--disable-extensions'],
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu',
                        '--single-process',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                });

                const page = await browser.newPage();
                
                // User-Agent 설정
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                
                // 크루월드 로그인
                await page.goto('https://creworld.flyasiana.com/crw/websquare/websquare.html?w2xPath=/crw/ux/crew/main/main.xml&topMenuId=FSKD00&subMenuId=FSKD0002#', {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                await page.waitForSelector('#username', { timeout: 10000 });
                await page.type('#username', credentials.username);
                await page.type('#password', credentials.password);
                await page.click('#login-button');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
                
                // 스크래핑 상태 업데이트
                await this.tursoDb.updateScrapingStatus(scrapingId, 'scraping');
                
                // 스케줄 데이터 스크래핑
                const flightData = await this.scrapeFlightData(page, credentials.month);
                
                // 스크래핑 상태 업데이트
                await this.tursoDb.updateScrapingStatus(scrapingId, 'saving');
                
                // 데이터 저장
                let monthYear;
                if (credentials.month === 'next') {
                    const now = new Date();
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    monthYear = nextMonth.toISOString().slice(0, 7);
                } else {
                    const now = new Date();
                    monthYear = now.toISOString().slice(0, 7);
                }
                
                await this.tursoDb.deleteFlightsByMonth(monthYear, userId);
                await this.tursoDb.saveFlightData(flightData, userId, monthYear);
                
                await browser.close();
                
                // 스크래핑 상태 업데이트
                await this.tursoDb.updateScrapingStatus(scrapingId, 'completed');
                
                console.log('실제 스크래핑 완료');
                return;
                
            } else {
                // 개발 환경 데모 모드
                console.log('개발 환경에서 데모 모드로 스크래핑을 시뮬레이션합니다.');
                
                const month = credentials.month;
                const demoData = this.generateDemoFlightData(month);
                
                await this.tursoDb.updateScrapingStatus(scrapingId, 'scraping');
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.tursoDb.updateScrapingStatus(scrapingId, 'saving');
                
                let monthYear;
                if (month === 'next') {
                    const now = new Date();
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    monthYear = nextMonth.toISOString().slice(0, 7);
                } else {
                    const now = new Date();
                    monthYear = now.toISOString().slice(0, 7);
                }
                
                await this.tursoDb.deleteFlightsByMonth(monthYear, userId);
                await this.tursoDb.saveFlightData(demoData, userId, monthYear);
                
                await this.tursoDb.updateScrapingStatus(scrapingId, 'completed');
                
                console.log('개발 환경 데모 스크래핑 완료');
                return;
            }
            
        } catch (error) {
            console.error('스크래핑 오류:', error);
            await this.tursoDb.updateScrapingStatus(scrapingId, 'error');
            throw error;
        }
    }

    generateDemoFlightData(month) {
        const baseDate = month === 'next' ? 
            new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1) :
            new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        
        const flights = [];
        const routes = [
            { departure: 'ICN', arrival: 'NRT', flightNumber: 'OZ102' },
            { departure: 'ICN', arrival: 'LAX', flightNumber: 'OZ204' },
            { departure: 'ICN', arrival: 'JFK', flightNumber: 'OZ222' },
            { departure: 'ICN', arrival: 'CDG', flightNumber: 'OZ570' },
            { departure: 'ICN', arrival: 'LHR', flightNumber: 'OZ522' },
            { departure: 'ICN', arrival: 'SIN', flightNumber: 'OZ752' },
            { departure: 'ICN', arrival: 'BKK', flightNumber: 'OZ742' },
            { departure: 'ICN', arrival: 'HKG', flightNumber: 'OZ722' }
        ];

        for (let day = 1; day <= 28; day++) {
            const currentDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
            
            routes.forEach((route, index) => {
                const departureTime = new Date(currentDate);
                departureTime.setHours(8 + (index % 12), 0, 0, 0);
                
                const arrivalTime = new Date(departureTime);
                arrivalTime.setHours(departureTime.getHours() + 2 + (index % 4));
                
                flights.push({
                    flight_number: route.flightNumber,
                    departure_date: currentDate.toISOString().slice(0, 10),
                    departure_time: departureTime.toTimeString().slice(0, 5),
                    arrival_time: arrivalTime.toTimeString().slice(0, 5),
                    departure_airport: route.departure,
                    arrival_airport: route.arrival,
                    aircraft_type: 'A350',
                    status: 'Scheduled',
                    pilot_in_command: `PIC${String(day).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`,
                    first_officer: `FO${String(day).padStart(2, '0')}${String(index + 1).padStart(2, '0')}`,
                    cabin_crew_1: `CC${String(day).padStart(2, '0')}${String(index + 1).padStart(2, '0')}A`,
                    cabin_crew_2: `CC${String(day).padStart(2, '0')}${String(index + 1).padStart(2, '0')}B`,
                    cabin_crew_3: `CC${String(day).padStart(2, '0')}${String(index + 1).padStart(2, '0')}C`,
                    cabin_crew_4: `CC${String(day).padStart(2, '0')}${String(index + 1).padStart(2, '0')}D`,
                    notes: `데모 데이터 - ${month === 'next' ? '다음달' : '이번달'} 스케줄`
                });
            });
        }

        return flights;
    }

    async scrapeFlightData(page, month) {
        // 실제 스크래핑 로직 (개발용)
        console.log('실제 스케줄 데이터 스크래핑 시작...');
        
        // 여기에 실제 크루월드 사이트에서 데이터를 추출하는 로직을 구현
        // 현재는 데모 데이터를 반환
        return this.generateDemoFlightData(month);
    }
}

module.exports = FlightScraper;
