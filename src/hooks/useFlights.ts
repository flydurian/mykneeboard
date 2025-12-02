import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllFlights, addFlight, updateFlight, deleteFlight } from '../firebase/database';
import { Flight } from '../../types';

// 쿼리 키 상수
export const flightKeys = {
    all: ['flights'] as const,
    lists: () => [...flightKeys.all, 'list'] as const,
    list: (userId: string) => [...flightKeys.lists(), userId] as const,
};

// 항공편 데이터 가져오기 훅
export const useFlights = (userId: string | undefined) => {
    return useQuery({
        queryKey: flightKeys.list(userId || ''),
        queryFn: () => getAllFlights(userId || ''),
        enabled: !!userId, // userId가 있을 때만 쿼리 실행
        staleTime: 1000 * 60 * 60, // 1시간으로 증가 (오프라인 대응)
        gcTime: 1000 * 60 * 60 * 24, // 24시간 (구 cacheTime)
        retry: (failureCount, error: any) => {
            // 오프라인 에러는 재시도하지 않음
            if (error?.message === 'OFFLINE_MODE') return false;
            return failureCount < 3;
        },
    });
};

// 항공편 추가 훅
export const useAddFlight = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ flightData, userId }: { flightData: any; userId: string }) =>
            addFlight(flightData, userId),
        onSuccess: (_, { userId }) => {
            // 데이터가 변경되었으므로 캐시 무효화 및 재요청
            queryClient.invalidateQueries({ queryKey: flightKeys.list(userId) });
        },
    });
};

// 항공편 수정 훅
export const useUpdateFlight = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ flightId, dataToUpdate, userId }: { flightId: number; dataToUpdate: any; userId: string }) =>
            updateFlight(flightId, dataToUpdate, userId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: flightKeys.list(userId) });
        },
    });
};

// 항공편 삭제 훅
export const useDeleteFlight = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            flightId,
            storagePath,
            userId
        }: {
            flightId: string;
            storagePath: { year: string; month: string; firebaseKey: string };
            userId: string
        }) => deleteFlight(flightId, storagePath, userId),
        onSuccess: (_, { userId }) => {
            queryClient.invalidateQueries({ queryKey: flightKeys.list(userId) });
        },
    });
};
