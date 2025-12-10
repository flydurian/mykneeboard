import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트합니다.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('❌ Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        // 캐시를 무시하고 새로고침
        window.location.reload();
    };

    private handleReset = () => {
        // 상태 초기화 및 로컬 스토리지 정리 (선택적)
        // localStorage.clear(); // 너무 과격할 수 있으므로 주석 처리
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-200 dark:border-gray-700">
                        <div className="mb-6">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                오류가 발생했습니다
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-wrap text-sm">
                                앱을 실행하는 도중 문제가 생겼습니다.{'\n'}
                                일시적인 문제일 수 있으니 새로고침을 시도해주세요.
                            </p>
                            {this.state.error && (
                                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32">
                                    <p className="text-xs text-red-600 dark:text-red-400 font-mono break-all">
                                        {this.state.error.toString()}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReload}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/30"
                            >
                                새로고침
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium transition-colors"
                            >
                                초기화 후 다시 로드
                            </button>
                        </div>

                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
                            문제가 지속되면 데이터 정리(초기화)를 시도해보세요.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
