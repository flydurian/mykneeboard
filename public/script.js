class FlightDataApp {
    constructor() {
        this.currentData = [];
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        this.setupEventListeners();
        this.initializeDataSection();
    }

    setupEventListeners() {
        // 로그아웃 버튼
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // 파일 업로드 폼
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFileUpload();
        });

        // 데이터 조회 버튼
        document.getElementById('loadDataBtn').addEventListener('click', () => {
            this.loadData();
        });

        // CSV 내보내기 버튼
        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.exportToCsv();
        });

        // 파일 선택 시 미리보기
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e);
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
                this.showStatus('로그아웃 중 오류가 발생했습니다.', 'error', 'uploadStatus');
            }
        } catch (error) {
            console.error('로그아웃 오류:', error);
            window.location.href = '/login';
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        const uploadStatus = document.getElementById('uploadStatus');
        
        if (file) {
            // 파일 크기 확인 (10MB 제한)
            if (file.size > 10 * 1024 * 1024) {
                this.showStatus('파일 크기가 10MB를 초과합니다.', 'error', 'uploadStatus');
                event.target.value = '';
                return;
            }
            
            // 파일 형식 확인
            const allowedTypes = ['.xls', '.xlsx'];
            const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            
            if (!allowedTypes.includes(fileExtension)) {
                this.showStatus('지원하지 않는 파일 형식입니다. .xls 또는 .xlsx 파일을 선택해주세요.', 'error', 'uploadStatus');
                event.target.value = '';
                return;
            }
            
            this.showStatus(`파일 선택됨: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`, 'info', 'uploadStatus');
        }
    }

    async handleFileUpload() {
        const fileInput = document.getElementById('fileInput');
        const monthSelect = document.getElementById('monthSelect');
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadProgress = document.getElementById('uploadProgress');
        
        const file = fileInput.files[0];
        const month = monthSelect.value;
        
        if (!file) {
            this.showStatus('파일을 선택해주세요.', 'error', 'uploadStatus');
            return;
        }
        
        if (!month) {
            this.showStatus('데이터 월을 선택해주세요.', 'error', 'uploadStatus');
            return;
        }
        
        // 업로드 버튼 비활성화
        uploadBtn.disabled = true;
        uploadBtn.textContent = '업로드 중...';
        uploadProgress.style.display = 'block';
        
        this.showStatus('파일을 업로드하고 있습니다...', 'info', 'uploadStatus');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('month', month);
            
            const response = await fetch('/api/upload-excel', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showStatus('✅ 파일 업로드 및 데이터 저장이 완료되었습니다!', 'success', 'uploadStatus');
                
                // 폼 초기화
                fileInput.value = '';
                monthSelect.value = '';
                
                // 데이터 조회 섹션 업데이트
                this.populateMonthOptions();
                await this.loadData();
            } else {
                this.showStatus(data.error || '파일 업로드에 실패했습니다.', 'error', 'uploadStatus');
            }
        } catch (error) {
            console.error('파일 업로드 오류:', error);
            this.showStatus('파일 업로드 중 오류가 발생했습니다.', 'error', 'uploadStatus');
        } finally {
            // 업로드 버튼 활성화
            uploadBtn.disabled = false;
            uploadBtn.textContent = '파일 업로드 및 저장';
            uploadProgress.style.display = 'none';
        }
    }

    initializeDataSection() {
        this.populateMonthOptions();
        this.updateTableHeaders();
    }

    populateMonthOptions() {
        const monthSelect = document.getElementById('dataMonthSelect');
        monthSelect.innerHTML = '<option value="">월을 선택하세요</option>';
        
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 7);
        
        const months = [
            { value: currentMonth, label: `${currentMonth} (이번달)` },
            { value: nextMonth, label: `${nextMonth} (다음달)` }
        ];
        
        months.forEach(month => {
            const option = document.createElement('option');
            option.value = month.value;
            option.textContent = month.label;
            monthSelect.appendChild(option);
        });
    }

    async loadData() {
        const month = document.getElementById('dataMonthSelect').value;
        
        if (!month) {
            this.showStatus('조회할 월을 선택해주세요.', 'error', 'uploadStatus');
            return;
        }
        
        try {
            const response = await fetch(`/api/flights/${month}`, {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentData = data.data || [];
                this.renderDataTable();
                this.showStatus(`${month} 데이터 조회 완료 (${this.currentData.length}개 항공편)`, 'success', 'uploadStatus');
            } else {
                this.showStatus(data.error || '데이터 조회에 실패했습니다.', 'error', 'uploadStatus');
            }
        } catch (error) {
            console.error('데이터 조회 오류:', error);
            this.showStatus('데이터 조회 중 오류가 발생했습니다.', 'error', 'uploadStatus');
        }
    }

    updateTableHeaders() {
        const tableHeader = document.getElementById('tableHeader');
        const headers = ['항공편 번호', '출발 시간', '도착 시간', '출발 공항', '도착 공항', '항공기', 'Flight Crew', 'Cabin Crew'];
        tableHeader.innerHTML = headers.map(header => `<th>${header}</th>`).join('');
    }

    renderDataTable() {
        const tableBody = document.getElementById('tableBody');
        const noDataMessage = document.getElementById('noDataMessage');
        
        if (this.currentData.length === 0) {
            tableBody.innerHTML = '';
            noDataMessage.style.display = 'block';
            return;
        }
        
        noDataMessage.style.display = 'none';
        
        const tableRows = this.currentData.map(flight => `
            <tr>
                <td class="flight-number">${flight.flight_number || '-'}</td>
                <td>${flight.std || '-'}</td>
                <td>${flight.sta || '-'}</td>
                <td><span class="airport-code">${flight.departure_airport || '-'}</span></td>
                <td><span class="airport-code">${flight.arrival_airport || '-'}</span></td>
                <td>${flight.hlno || '-'}</td>
                <td>${flight.flight_crew_count || 0}명</td>
                <td>${flight.cabin_crew_count || 0}명</td>
            </tr>
        `).join('');
        
        tableBody.innerHTML = tableRows;
    }

    exportToCsv() {
        if (this.currentData.length === 0) {
            this.showStatus('내보낼 데이터가 없습니다.', 'error', 'uploadStatus');
            return;
        }
        
        const month = document.getElementById('dataMonthSelect').value;
        if (!month) {
            this.showStatus('내보낼 월을 선택해주세요.', 'error', 'uploadStatus');
            return;
        }
        
        // CSV 헤더
        const headers = ['항공편 번호', '출발 시간', '도착 시간', '출발 공항', '도착 공항', '항공기'];
        const csvContent = [
            headers.join(','),
            ...this.currentData.map(flight => [
                flight.flight_number || '',
                flight.std || '',
                flight.sta || '',
                flight.departure_airport || '',
                flight.arrival_airport || '',
                flight.hlno || ''
            ].join(','))
        ].join('\n');
        
        // CSV 파일 다운로드
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `항공편_데이터_${month}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showStatus('CSV 파일이 다운로드되었습니다.', 'success', 'uploadStatus');
    }

    showStatus(message, type, elementId = 'uploadStatus') {
        const statusElement = document.getElementById(elementId);
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        
        const timeout = type === 'success' ? 8000 : 5000;
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status-message';
        }, timeout);
    }

    updateUserDisplay() {
        const userDisplay = document.getElementById('userDisplay');
        const userEmail = document.getElementById('userEmail');
        const userProfilePic = document.getElementById('userProfilePic');
        
        if (this.user) {
            userDisplay.textContent = this.user.display_name || this.user.username || '사용자';
            userEmail.textContent = this.user.email || '';
            
            if (this.user.profile_picture) {
                userProfilePic.src = this.user.profile_picture;
                userProfilePic.style.display = 'block';
            } else {
                // 기본 프로필 이미지
                userProfilePic.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2NjdFRUEiLz4KPHBhdGggZD0iTTIwIDEwQzIyLjIwOTEgMTAgMjQgMTEuNzkwOSAyNCAxNEMyNCAxNi4yMDkxIDIyLjIwOTEgMTggMjAgMThDMTcuNzkwOSAxOCAxNiAxNi4yMDkxIDE2IDE0QzE2IDExLjc5MDkgMTcuNzkwOSAxMCAyMCAxMFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0yOCAyNkMyOCAyOS4zMTM3IDI0LjQxODMgMzIgMjAgMzJDMjUuNTgxNyAzMiAyOCAyOS4zMTM3IDI4IDI2WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
                userProfilePic.style.display = 'block';
            }
        }
    }

    showMainContent() {
        // 로딩 상태 제거
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(el => el.style.display = 'none');
        
        // 메인 콘텐츠 표시
        const mainContent = document.querySelector('.container');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
        
        // 데이터 섹션 초기화
        this.initializeDataSection();
    }

    redirectToLogin() {
        console.log('로그인 페이지로 리다이렉트...');
        window.location.href = '/login';
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new FlightDataApp();
});
