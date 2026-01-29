import { Flight } from '../types';
import { ConflictResolver, ConflictInfo } from './conflictResolver';

interface SyncOperation {
  id: string;
  type: 'update_status' | 'add_flight' | 'delete_flight';
  data: any;
  timestamp: number;
  retryCount: number;
}

interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
  conflicts: string[];
  resolvedConflicts: number;
}

class SyncStrategy {
  private readonly SYNC_QUEUE_KEY = 'sync_queue';
  private readonly MAX_RETRY_COUNT = 3;
  private isSyncing = false;

  // 동기화 큐에 작업 추가
  addToSyncQueue(operation: Omit<SyncOperation, 'id' | 'retryCount'>): void {
    const syncOperation: SyncOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random()}`,
      retryCount: 0
    };

    try {
      const queue = this.getSyncQueue();
      queue.push(syncOperation);
      this.saveSyncQueue(queue);

    } catch (error) {
      console.error('동기화 큐 추가 실패:', error);
    }
  }

  // 동기화 큐 가져오기
  private getSyncQueue(): SyncOperation[] {
    try {
      const queue = localStorage.getItem(this.SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }

  // 동기화 큐 저장
  private saveSyncQueue(queue: SyncOperation[]): void {
    try {
      localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('동기화 큐 저장 실패:', error);
    }
  }

  // 개선된 동기화 실행 (변경된 사항만)
  async sync(
    userId: string,
    localFlights: Flight[],
    onConflictResolution?: (conflicts: ConflictInfo[]) => Promise<{ flightId: number; useLocal: boolean }[]>
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedCount: 0,
        errors: ['이미 동기화 중입니다.'],
        conflicts: [],
        resolvedConflicts: 0
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      errors: [],
      conflicts: [],
      resolvedConflicts: 0
    };

    try {
      // 1단계: 서버 데이터 가져오기
      const serverFlights = await this.fetchServerData(userId);

      // 2단계: 변경된 사항만 감지
      const changedFlights = this.detectChangedFlights(localFlights, serverFlights);


      // 3단계: 충돌 감지 (변경된 항공편 중에서만)
      const conflicts = ConflictResolver.detectConflicts(changedFlights.local, changedFlights.server);

      // 4단계: 충돌 해결 (변경된 항공편만)
      if (conflicts.length > 0 && onConflictResolution) {
        await this.resolveConflictsWithUserChoice(conflicts, result, onConflictResolution, userId);
      } else if (conflicts.length > 0) {
        await this.resolveConflictsAutomatically(conflicts, result);
      }

      // 5단계: 로컬 변경사항 전송 (동기화 큐에서만)
      await this.sendLocalChanges(userId, result);

    } catch (error) {
      result.success = false;
      result.errors.push(`동기화 오류: ${error}`);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  // 서버 데이터 가져오기
  private async fetchServerData(userId: string): Promise<Flight[]> {
    const { getAllFlights } = await import('../src/firebase/database');
    return await getAllFlights(userId);
  }

  // 변경된 사항만 감지
  private detectChangedFlights(localFlights: Flight[], serverFlights: Flight[]): {
    local: Flight[];
    server: Flight[];
  } {
    const changedLocal: Flight[] = [];
    const changedServer: Flight[] = [];

    // 로컬에서 변경된 항공편 찾기
    for (const localFlight of localFlights) {
      const serverFlight = serverFlights.find(f => f.id === localFlight.id);
      if (serverFlight) {
        // 상태가 다르거나 버전이 다른 경우 변경된 것으로 간주
        if (this.hasChanges(localFlight, serverFlight)) {
          changedLocal.push(localFlight);
          changedServer.push(serverFlight);
        }
      } else {
        // 서버에 없는 새로운 항공편
        changedLocal.push(localFlight);
      }
    }

    // 서버에만 있는 새로운 항공편 찾기
    for (const serverFlight of serverFlights) {
      const localFlight = localFlights.find(f => f.id === serverFlight.id);
      if (!localFlight) {
        changedServer.push(serverFlight);
      }
    }

    return { local: changedLocal, server: changedServer };
  }

  // 변경 여부 확인
  private hasChanges(local: Flight, server: Flight): boolean {
    // 상태 변경 확인
    if (local.status.departed !== server.status.departed ||
      local.status.landed !== server.status.landed) {
      return true;
    }

    // 버전 변경 확인
    if (local.version !== server.version) {
      return true;
    }

    // 마지막 수정 시간 확인 (5분 이상 차이나면 변경된 것으로 간주)
    if (local.lastModified && server.lastModified) {
      const localTime = new Date(local.lastModified).getTime();
      const serverTime = new Date(server.lastModified).getTime();
      const timeDiff = Math.abs(localTime - serverTime);
      if (timeDiff > 5 * 60 * 1000) { // 5분
        return true;
      }
    }

    return false;
  }

  // 사용자 선택을 통한 충돌 해결 (변경된 사항만)
  private async resolveConflictsWithUserChoice(
    conflicts: ConflictInfo[],
    result: SyncResult,
    onConflictResolution: (conflicts: ConflictInfo[]) => Promise<{ flightId: number; useLocal: boolean }[]>,
    userId: string
  ): Promise<void> {
    try {
      const resolutions = await onConflictResolution(conflicts);

      // ✨ 각 충돌에 대해 사용자의 선택을 처리
      for (const conflict of conflicts) {
        try {
          const resolution = resolutions.find(r => r.flightId === conflict.flightId);
          if (!resolution) continue;

          // 1. 사용자의 선택에 따라 '최종 기준'이 될 데이터를 정합니다.
          let chosenData;
          if (resolution.useLocal) {
            chosenData = conflict.localData;

          } else {
            chosenData = conflict.serverData;

          }

          // 2. 선택된 데이터에서 'status' 객체를 통째로 가져옵니다.
          const finalStatus = chosenData.status;

          // status 객체가 없는 경우를 대비한 안전장치
          if (!finalStatus) {
            console.error(`선택된 데이터에 status 정보가 없습니다: ${conflict.flightId}`);
            continue;
          }

          // 3. Firebase에 업데이트할 최종 데이터를 준비합니다.
          // 항상 status 객체 전체와 수정 시간을 함께 보냅니다.
          const dataToUpdate = {
            status: finalStatus,
            lastModified: new Date().toISOString() // 동기화 시점의 시간으로 업데이트
          };



          // 4. Firebase 문서를 업데이트합니다.
          const { updateFlight } = await import('../src/firebase/database');
          await updateFlight(conflict.flightId, dataToUpdate, userId);


          result.resolvedConflicts++;
          result.conflicts.push(`사용자 선택 해결: ${conflict.flightId}`);

        } catch (error) {
          console.error(`충돌 해결 적용 실패: ${conflict.flightId} - ${error}`);
          result.errors.push(`충돌 해결 적용 실패: ${conflict.flightId} - ${error}`);
        }
      }
    } catch (error) {
      console.error(`사용자 충돌 해결 실패: ${error}`);
      result.errors.push(`사용자 충돌 해결 실패: ${error}`);
    }
  }

  // 자동 충돌 해결
  private async resolveConflictsAutomatically(conflicts: ConflictInfo[], result: SyncResult): Promise<void> {
    for (const conflict of conflicts) {
      try {
        const resolution = ConflictResolver.resolveConflict(conflict);
        result.resolvedConflicts++;
        result.conflicts.push(`자동 해결 (${resolution.strategy}): ${conflict.flightId}`);
      } catch (error) {
        result.errors.push(`충돌 해결 실패: ${conflict.flightId} - ${error}`);
      }
    }
  }

  // 로컬 변경사항 전송 (변경된 사항만)
  private async sendLocalChanges(userId: string, result: SyncResult): Promise<void> {
    const queue = this.getSyncQueue();

    // 변경된 작업만 필터링
    const changedOperations = queue.filter(operation => {
      // 최근 5분 내의 작업만 처리
      const operationTime = new Date(operation.timestamp).getTime();
      const currentTime = Date.now();
      return (currentTime - operationTime) < 5 * 60 * 1000; // 5분
    });



    for (const operation of changedOperations) {
      try {
        await this.processOperation(operation, userId);
        result.syncedCount++;
        this.removeFromQueue(operation.id);
      } catch (error) {
        operation.retryCount++;

        if (operation.retryCount >= this.MAX_RETRY_COUNT) {
          result.errors.push(`최대 재시도 횟수 초과: ${operation.type}`);
          this.removeFromQueue(operation.id);
        } else {
          result.errors.push(`동기화 실패 (재시도 ${operation.retryCount}/${this.MAX_RETRY_COUNT}): ${operation.type}`);
          this.updateRetryCount(operation.id, operation.retryCount);
        }
      }
    }
  }

  // 개별 작업 처리
  private async processOperation(operation: SyncOperation, userId: string): Promise<void> {
    const { updateFlight } = await import('../src/firebase/database');

    switch (operation.type) {
      case 'update_status':
        // ✨ 중요: 완전한 status 객체를 사용하여 부분적 업데이트 방지
        const updateData = {
          status: operation.data.status, // ✨ 완전한 status 객체 사용
          lastModified: operation.data.lastModified, // ✨ 큐에 저장된 원본 시간 사용
          version: operation.data.version
        };



        await updateFlight(operation.data.flightId.toString(), updateData, userId);
        break;
      case 'add_flight':
        // addFlight 함수 호출
        break;
      case 'delete_flight':
        // deleteFlight 함수 호출
        break;
      default:
        throw new Error(`알 수 없는 작업 타입: ${operation.type}`);
    }
  }

  // 큐에서 작업 제거
  private removeFromQueue(operationId: string): void {
    const queue = this.getSyncQueue();
    const filteredQueue = queue.filter(op => op.id !== operationId);
    this.saveSyncQueue(filteredQueue);
  }

  // 재시도 횟수 업데이트
  private updateRetryCount(operationId: string, retryCount: number): void {
    const queue = this.getSyncQueue();
    const updatedQueue = queue.map(op =>
      op.id === operationId ? { ...op, retryCount } : op
    );
    this.saveSyncQueue(updatedQueue);
  }

  // 동기화 상태 확인
  getSyncStatus(): { pendingCount: number; lastSync: Date | null; isSyncing: boolean } {
    const queue = this.getSyncQueue();
    const lastSync = queue.length > 0 ?
      new Date(Math.max(...queue.map(op => op.timestamp))) : null;

    return {
      pendingCount: queue.length,
      lastSync,
      isSyncing: this.isSyncing
    };
  }

  // 동기화 큐 초기화
  clearSyncQueue(): void {
    localStorage.removeItem(this.SYNC_QUEUE_KEY);
  }
}

export const syncStrategy = new SyncStrategy();
