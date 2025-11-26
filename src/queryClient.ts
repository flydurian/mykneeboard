import { QueryClient } from '@tanstack/react-query';
import { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';

// 1시간 (밀리초)
const STALE_TIME = 1000 * 60 * 60;
// 7일 (밀리초)
const GC_TIME = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: STALE_TIME, // 데이터가 1시간 동안은 '신선'하다고 간주 (재요청 안함)
            gcTime: GC_TIME,       // 사용되지 않는 데이터도 7일간 캐시 유지 (오프라인 지원)
            retry: 1,
            refetchOnWindowFocus: false, // 창 포커스 시 재요청 방지 (데이터 변경이 잦지 않음)
        },
    },
});

// IDB-Keyval을 사용한 Persister 생성
// IndexedDB에 쿼리 캐시를 저장하여 오프라인에서도 데이터를 유지합니다.
export const createIDBPersister = (idbValidKey: IDBValidKey = 'reactQueryClient'): Persister => {
    return {
        persistClient: async (client: PersistedClient) => {
            await set(idbValidKey, client);
        },
        restoreClient: async () => {
            return await get<PersistedClient>(idbValidKey);
        },
        removeClient: async () => {
            await del(idbValidKey);
        },
    };
};

export const persister = createIDBPersister();
