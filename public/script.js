class FlightDataApp {
    constructor() {
        this.currentScrapingId = null;
        this.selectedMonth = null;
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // 로그아웃 버튼
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // 온라인 업데이트 폼
        document.getElementById('updateForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpdateSubmit();
        });

        // 월 선택 버튼 이벤트
        document.querySelectorAll('.month-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectMonth(e.target.closest('.month-btn').dataset.month);
            });
        });
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/status', {
                credentials: 'include'
            });
            const data = await response.json();
            
            if (!data.isAuthenticated) {
                window.location.href = '/login';
                return;
            }
            
            // 사용자 정보 표시
            const userDisplay = document.getElementById('userDisplay');
            const userEmail = document.getElementById('userEmail');
            const userProfilePic = document.getElementById('userProfilePic');
            
            userDisplay.textContent = data.user.display_name || data.user.username;
            userEmail.textContent = data.user.email;
            
            if (data.user.profile_picture) {
                userProfilePic.src = data.user.profile_picture;
                userProfilePic.style.display = 'block';
            } else {
                // 기본 프로필 이미지
                userProfilePic.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdFRUEiLz4KPHBhdGggZD0iTTIwIDEwQzIyLjIwOTEgMTAgMjQgMTEuNzkwOSAyNCAxNEMyNCAxNi4yMDkxIDIyLjIwOTEgMTggMjAgMThDMTcuNzkwOSAxOCAxNiAxNi4yMDkxIDE2IDE0QzE2IDExLjc5MDkgMTcuNzkwOSAxMCAyMCAxMFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yOCAyNkMyOCAyOS4zMTM3IDI0LjQxODMgMzIgMjAgMzJDMjUuNTgxNyAzMiAyOCAyOS4zMTM3IDI4IDI2WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
                userProfilePic.style.display = 'block';
            }
            
        } catch (error) {
            console.error('인증 상태 확인 오류:', error);
            window.location.href = '/login';
        }
    }

    async logout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                window.location.href = '/login';
            } else {
                this.showStatus('로그아웃 중 오류가 발생했습니다.', 'error', 'updateStatus');
            }
        } catch (error) {
            console.error('로그아웃 오류:', error);
            window.location.href = '/login';
        }
    }

    selectMonth(monthType) {
        // 모든 버튼에서 선택 상태 제거
        document.querySelectorAll('.month-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // 선택된 버튼에 선택 상태 추가
        const selectedBtn = document.querySelector(`[data-month="${monthType}"]`);
        selectedBtn.classList.add('selected');

        this.selectedMonth = monthType;

        // 업데이트 버튼 활성화 및 텍스트 업데이트
        const updateBtn = document.getElementById('updateBtn');
        const monthText = monthType === 'current' ? '이번달' : '다음달';
        updateBtn.textContent = `${monthText} 업데이트 시작`;
        updateBtn.disabled = false;
    }

    async handleUpdateSubmit() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showStatus('사용자명과 비밀번호를 입력해주세요.', 'error', 'updateStatus');
            return;
        }

        if (!this.selectedMonth) {
            this.showStatus('업데이트할 월을 선택해주세요.', 'error', 'updateStatus');
            return;
        }

        const updateBtn = document.querySelector('#updateForm button[type="submit"]');
        const progressBar = document.getElementById('progressBar');
        
        updateBtn.disabled = true;
        updateBtn.textContent = '업데이트 중...';
        progressBar.style.display = 'block';
        
        const monthText = this.selectedMonth === 'current' ? '이번달' : '다음달';
        this.showStatus(`${monthText} 데이터 업데이트를 시작합니다...`, 'info', 'updateStatus');

        try {
            const response = await fetch('/api/update-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // 쿠키 포함
                body: JSON.stringify({ 
                    username, 
                    password,
                    month: this.selectedMonth 
                }),
            });

            const data = await response.json();

            if (data.success) {
                this.currentScrapingId = data.scrapingId;
                this.showStatus(data.message, 'info', 'updateStatus');
                this.monitorUpdateProgress();
            } else {
                this.showStatus(data.error, 'error', 'updateStatus');
                this.resetUpdateButton();
            }
        } catch (error) {
            this.showStatus('업데이트 시작 중 오류가 발생했습니다.', 'error', 'updateStatus');
            this.resetUpdateButton();
        }
    }

    async monitorUpdateProgress() {
        if (!this.currentScrapingId) return;
        
        console.log('업데이트 진행 상황 모니터링 시작:', this.currentScrapingId);
        
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/update-status/${this.currentScrapingId}`, {
                    credentials: 'include'
                });
                const data = await response.json();
                
                console.log('업데이트 상태 확인:', data);

                if (data.status === 'completed') {
                    const monthText = this.selectedMonth === 'current' ? '이번달' : '다음달';
                    this.showStatus(`${monthText} 업데이트가 완료되었습니다!`, 'success', 'updateStatus');
                    this.resetUpdateButton();
                    clearInterval(interval);
                } else if (data.status === 'error') {
                    this.showStatus(`업데이트 오류: ${data.error}`, 'error', 'updateStatus');
                    this.resetUpdateButton();
                    clearInterval(interval);
                } else if (data.status === 'starting' || data.status === 'connecting' || data.status === 'scraping' || data.status === 'saving') {
                    // 진행 중인 상태 표시
                    const statusMessages = {
                        'starting': '업데이트를 시작하고 있습니다...',
                        'connecting': '크루월드에 연결하고 있습니다...',
                        'scraping': '데이터를 수집하고 있습니다...',
                        'saving': '데이터베이스에 저장하고 있습니다...'
                    };
                    this.showStatus(statusMessages[data.status] || '업데이트 중...', 'info', 'updateStatus');
                } else {
                    // 기타 상태 (idle 등)
                    console.log('알 수 없는 상태:', data.status);
                }
            } catch (error) {
                console.error('진행 상황 확인 오류:', error);
                this.showStatus('진행 상황 확인 중 오류가 발생했습니다.', 'error', 'updateStatus');
            }
        }, 3000);
        
        // 30초 후에도 완료되지 않으면 타임아웃 처리
        setTimeout(() => {
            clearInterval(interval);
            this.showStatus('업데이트가 시간 초과되었습니다. 다시 시도해주세요.', 'error', 'updateStatus');
            this.resetUpdateButton();
        }, 30000);
    }

    resetUpdateButton() {
        const updateBtn = document.querySelector('#updateForm button[type="submit"]');
        const progressBar = document.getElementById('progressBar');
        
        updateBtn.disabled = false;
        updateBtn.textContent = '온라인 업데이트 시작';
        progressBar.style.display = 'none';
        
        // 선택 상태 초기화
        this.selectedMonth = null;
        document.querySelectorAll('.month-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        document.getElementById('updateForm').reset();
    }

    showStatus(message, type, elementId = 'updateStatus') {
        const statusElement = document.getElementById(elementId);
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        const timeout = type === 'success' ? 8000 : 5000;
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status-message';
        }, timeout);
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new FlightDataApp();
});
