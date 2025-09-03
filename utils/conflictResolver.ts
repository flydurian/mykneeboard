import { Flight } from '../types';

export interface ConflictInfo {
  flightId: number;
  flightNumber: string;
  date: string;
  route: string;
  localData: {
    status: {
      departed: boolean;
      landed: boolean;
    };
    lastModified?: string;
  };
  serverData: {
    status: {
      departed: boolean;
      landed: boolean;
    };
    lastModified?: string;
  };
}

export interface ConflictResolution {
  strategy: 'server-wins' | 'client-wins' | 'merge' | 'manual';
  resolution: any;
  reason: string;
}

export class ConflictResolver {
  // 충돌 감지 (상태 비교)
  static detectConflicts(localFlights: Flight[], serverFlights: Flight[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    
    for (const localFlight of localFlights) {
      const serverFlight = serverFlights.find(f => f.id === localFlight.id);
      if (serverFlight && this.hasConflict(localFlight, serverFlight)) {
        conflicts.push({
          flightId: localFlight.id,
          flightNumber: localFlight.flightNumber,
          date: localFlight.date,
          route: localFlight.route,
          localData: {
            status: localFlight.status,
            lastModified: localFlight.lastModified
          },
          serverData: {
            status: serverFlight.status,
            lastModified: serverFlight.lastModified
          }
        });
      }
    }
    
    return conflicts;
  }

  // 충돌 여부 확인 (상태 비교)
  private static hasConflict(local: Flight, server: Flight): boolean {
    // 상태가 다른 경우 충돌로 간주
    return (
      local.status.departed !== server.status.departed ||
      local.status.landed !== server.status.landed
    );
  }

  // 자동 충돌 해결 (로컬 우선)
  static resolveConflict(conflict: ConflictInfo): ConflictResolution {
    return {
      strategy: 'client-wins',
      resolution: conflict.localData,
      reason: '로컬 데이터가 우선됩니다.'
    };
  }

  // 사용자 선택을 통한 충돌 해결
  static async resolveWithUserChoice(
    conflicts: ConflictInfo[],
    onUserChoice: (resolutions: { flightId: number; useLocal: boolean }[]) => Promise<void>
  ): Promise<{ resolvedCount: number; errors: string[] }> {
    const result = { resolvedCount: 0, errors: [] };
    
    try {
      // 사용자에게 선택권 제공
      await onUserChoice(conflicts.map(conflict => ({
        flightId: conflict.flightId,
        useLocal: true // 기본값
      })));
      
      result.resolvedCount = conflicts.length;
    } catch (error) {
      result.errors.push(`사용자 선택 실패: ${error}`);
    }
    
    return result;
  }

  // 선택된 해결책에 따라 데이터 적용
  static applyResolutions(
    conflicts: ConflictInfo[],
    resolutions: { flightId: number; useLocal: boolean }[]
  ): { flightId: number; finalData: any }[] {
    return conflicts.map(conflict => {
      const resolution = resolutions.find(r => r.flightId === conflict.flightId);
      const useLocal = resolution?.useLocal ?? true;
      
      // 선택된 데이터의 원본 시간 정보를 보존
      const selectedData = useLocal ? conflict.localData : conflict.serverData;
      
      return {
        flightId: conflict.flightId,
        finalData: {
          status: selectedData.status,
          lastModified: selectedData.lastModified, // 원본 시간 정보 보존
          version: (selectedData.version || 0) + 1
        }
      };
    });
  }
}
