import React, { useState, useEffect, useRef } from 'react';
import { XIcon } from '../icons';

interface CrewMemoModalProps {
    isOpen: boolean;
    onClose: () => void;
    crewName: string;
    initialMemo?: string;
    onSave: (crewName: string, memo: string) => void;
}

const CrewMemoModal: React.FC<CrewMemoModalProps> = ({ 
    isOpen, 
    onClose, 
    crewName, 
    initialMemo = '', 
    onSave 
}) => {
    const [memo, setMemo] = useState(initialMemo);
    const [isComposing, setIsComposing] = useState(false);
    const draftMemoRef = useRef<string>(initialMemo);
    const [editLength, setEditLength] = useState<number>(initialMemo?.length || 0);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showTextColorPalette, setShowTextColorPalette] = useState(false);
    const [showBackgroundColorPalette, setShowBackgroundColorPalette] = useState(false);
    const [showSymbolPalette, setShowSymbolPalette] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const MAX_LENGTH = 10000;

    // 읽기 표시용: 가운데 정렬 등 불필요한 인라인 정렬을 제거
    const sanitizeForRead = (html: string): string => {
        if (!html) return html;
        let out = html;
        out = out.replace(/text-align\s*:\s*center;?/gi, '');
        out = out.replace(/text-align\s*:\s*right;?/gi, '');
        out = out.replace(/text-align\s*:\s*justify;?/gi, '');
        out = out.replace(/align\s*=\s*"?center"?/gi, '');
        out = out.replace(/align\s*=\s*"?right"?/gi, '');
        // 빈 style 제거
        out = out.replace(/style\s*=\s*"\s*"/gi, '');
        return out;
    };

    useEffect(() => {
        if (isOpen) {
            setMemo(initialMemo);
            setIsEditing(false); // 모달이 열릴 때 편집 모드 해제
            // 모달이 열릴 때 배경 스크롤 방지
            document.body.style.overflow = 'hidden';
            // 모달이 열릴 때마다 텍스트 영역 높이 조정
            setTimeout(() => {
                adjustTextareaHeight();
            }, 0);
        } else {
            // 모달이 닫힐 때 배경 스크롤 복원
            document.body.style.overflow = 'unset';
        }

        // 컴포넌트 언마운트 시 스크롤 복원
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, initialMemo]);

    // 편집 모드가 변경될 때 텍스트 영역 포커스 및 초기 내용 주입
    useEffect(() => {
        if (isEditing) {
            const el = textareaRef.current;
            if (!el) return;
            if (el.innerHTML !== memo) {
                el.innerHTML = memo || '';
            }
            setTimeout(() => {
                const node = textareaRef.current;
                if (!node) return;
                node.focus();
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(node as Node);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
            }, 100);
        }
    }, [isEditing, memo]);

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            const minHeight = 200; // 최소 높이
            
            // contentEditable div의 경우 scrollHeight를 사용하여 내용에 맞게 높이 조정
            const scrollHeight = textarea.scrollHeight;
            
            // 최소 높이를 보장하면서 내용에 맞게 높이 조정
            const newHeight = Math.max(minHeight, scrollHeight);
            textarea.style.height = newHeight + 'px';
            
            textarea.style.overflowY = 'auto';
        }
    };

    // 텍스트 변경 핸들러
    const handleTextChange = (e: React.FormEvent<HTMLDivElement>) => {
        if (isComposing) return;
        const target = e.target as HTMLDivElement;
        draftMemoRef.current = target.innerHTML;
        setEditLength(draftMemoRef.current.length);
        // 텍스트 변경 후 높이 조정
        setTimeout(() => {
            adjustTextareaHeight();
        }, 0);
    };

    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    const handleCompositionEnd = () => {
        setIsComposing(false);
        if (textareaRef.current) {
            draftMemoRef.current = textareaRef.current.innerHTML;
            setEditLength(draftMemoRef.current.length);
        }
        setTimeout(() => {
            adjustTextareaHeight();
        }, 0);
    };

    // innerHTML 설정을 위한 useEffect (읽기 모드에서만 반영)
    useEffect(() => {
        if (!isEditing && textareaRef.current && memo !== textareaRef.current.innerHTML) {
            textareaRef.current.innerHTML = memo || '<span class="text-gray-500 dark:text-gray-400">메모를 입력하세요...</span>';
            setTimeout(() => {
        adjustTextareaHeight();
            }, 0);
        }
    }, [memo, isEditing]);

    // 키 입력 핸들러 (엔터 키 처리)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            document.execCommand('insertLineBreak');
            e.preventDefault();
            return;
        }
    };

    // 목록 기능 (contentEditable용)
    const insertList = (ordered: boolean = false) => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
            
            // 들여쓰기와 점/번호 추가
            const indent = '    '; // 4칸 들여쓰기 (공백)
            const bullet = ordered ? '1. ' : '• ';
            const listText = indent + bullet;
            
            // 현재 위치에 목록 텍스트 삽입
                const textNode = document.createTextNode(listText);
                range.deleteContents();
                range.insertNode(textNode);
            
            // 커서를 목록 텍스트 뒤로 이동
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // 메모 상태 업데이트
                setMemo(textareaRef.current.innerHTML);
            }
        }
    };

    // 폰트 크기 변경
    const changeFontSize = (size: string) => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                
                if (selectedText) {
                    // 선택된 텍스트에 폰트 크기 적용
                    const span = document.createElement('span');
                    span.style.fontSize = `${size}px`;
                    span.textContent = selectedText;
                    range.deleteContents();
                    range.insertNode(span);
                    setMemo(textareaRef.current.innerHTML);
                }
            }
        }
    };

    // 텍스트 색상 변경
    const changeTextColor = (color: string) => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                
                if (selectedText) {
                    if (color === '#000000') {
                        // 기본색(검은색)을 선택하면 색상 제거
                        let container = range.commonAncestorContainer;
                        if (container.nodeType === Node.TEXT_NODE) {
                            container = container.parentNode!;
                        }
                        
                        // span 태그를 찾아서 색상 제거
                        let spanElement = null;
                        let currentElement = container;
                        
                        // 부모 요소들을 순회하면서 color 스타일이 있는 span 찾기
                        while (currentElement && currentElement !== textareaRef.current) {
                            if (currentElement.nodeType === Node.ELEMENT_NODE) {
                                const element = currentElement as HTMLElement;
                                if (element.tagName === 'SPAN' && element.style.color) {
                                    spanElement = element;
                                    break;
                                }
                            }
                            currentElement = currentElement.parentNode;
                        }
                        
                        if (spanElement) {
                            const parent = spanElement.parentNode;
                            if (parent) {
                                parent.insertBefore(document.createTextNode(spanElement.textContent || ''), spanElement);
                                parent.removeChild(spanElement);
                            }
                        }
                    } else {
                        // 다른 색상을 선택하면 색상 적용
                        const span = document.createElement('span');
                        span.style.color = color;
                        span.textContent = selectedText;
                        range.deleteContents();
                        range.insertNode(span);
                    }
                    setMemo(textareaRef.current.innerHTML);
                }
            }
        }
    };

    // 배경 색상 변경
    const changeBackgroundColor = (color: string) => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                
                if (selectedText) {
                    // 선택된 텍스트에 배경색 적용
                    const bgColor = color === 'transparent' ? 'transparent' : color;
                    const span = document.createElement('span');
                    span.style.backgroundColor = bgColor;
                    span.textContent = selectedText;
                    range.deleteContents();
                    range.insertNode(span);
                    setMemo(textareaRef.current.innerHTML);
                }
            }
        }
    };

    // 볼드 토글
    const applyBold = () => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                
                if (selectedText) {
                    // 선택된 텍스트가 이미 strong 태그 안에 있는지 확인
                    let container = range.commonAncestorContainer;
                    if (container.nodeType === Node.TEXT_NODE) {
                        container = container.parentNode!;
                    }
                    
                    // strong 태그를 찾아서 토글
                    let strongElement = null;
                    let currentElement = container;
                    
                    // 부모 요소들을 순회하면서 strong 태그 찾기
                    while (currentElement && currentElement !== textareaRef.current) {
                        if (currentElement.nodeType === Node.ELEMENT_NODE) {
                            const element = currentElement as HTMLElement;
                            if (element.tagName === 'STRONG') {
                                strongElement = element;
                                break;
                            }
                        }
                        currentElement = currentElement.parentNode;
                    }
                    
                    if (strongElement) {
                        // 이미 볼드이면 해제
                        const parent = strongElement.parentNode;
                        if (parent) {
                            parent.insertBefore(document.createTextNode(strongElement.textContent || ''), strongElement);
                            parent.removeChild(strongElement);
                        }
                    } else {
                        // 볼드가 아니면 적용
                        const strong = document.createElement('strong');
                        strong.textContent = selectedText;
                        range.deleteContents();
                        range.insertNode(strong);
                    }
                    setMemo(textareaRef.current.innerHTML);
                }
            }
        }
    };

    // 이탤릭 토글
    const applyItalic = () => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                
                if (selectedText) {
                    // 선택된 텍스트가 이미 em 태그 안에 있는지 확인
                    let container = range.commonAncestorContainer;
                    if (container.nodeType === Node.TEXT_NODE) {
                        container = container.parentNode!;
                    }
                    
                    // em 태그를 찾아서 토글
                    let emElement = null;
                    let currentElement = container;
                    
                    // 부모 요소들을 순회하면서 em 태그 찾기
                    while (currentElement && currentElement !== textareaRef.current) {
                        if (currentElement.nodeType === Node.ELEMENT_NODE) {
                            const element = currentElement as HTMLElement;
                            if (element.tagName === 'EM') {
                                emElement = element;
                                break;
                            }
                        }
                        currentElement = currentElement.parentNode;
                    }
                    
                    if (emElement) {
                        // 이미 이탤릭이면 해제
                        const parent = emElement.parentNode;
                        if (parent) {
                            parent.insertBefore(document.createTextNode(emElement.textContent || ''), emElement);
                            parent.removeChild(emElement);
                        }
                    } else {
                        // 이탤릭이 아니면 적용
                        const em = document.createElement('em');
                        em.textContent = selectedText;
                        range.deleteContents();
                        range.insertNode(em);
                    }
                    setMemo(textareaRef.current.innerHTML);
                }
            }
        }
    };

    // 밑줄 토글
    const applyUnderline = () => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                
                if (selectedText) {
                    // 선택된 텍스트가 이미 u 태그 안에 있는지 확인
                    let container = range.commonAncestorContainer;
                    if (container.nodeType === Node.TEXT_NODE) {
                        container = container.parentNode!;
                    }
                    
                    // u 태그를 찾아서 토글
                    let uElement = null;
                    let currentElement = container;
                    
                    // 부모 요소들을 순회하면서 u 태그 찾기
                    while (currentElement && currentElement !== textareaRef.current) {
                        if (currentElement.nodeType === Node.ELEMENT_NODE) {
                            const element = currentElement as HTMLElement;
                            if (element.tagName === 'U') {
                                uElement = element;
                                break;
                            }
                        }
                        currentElement = currentElement.parentNode;
                    }
                    
                    if (uElement) {
                        // 이미 밑줄이면 해제
                        const parent = uElement.parentNode;
                        if (parent) {
                            parent.insertBefore(document.createTextNode(uElement.textContent || ''), uElement);
                            parent.removeChild(uElement);
                        }
                    } else {
                        // 밑줄이 아니면 적용
                        const u = document.createElement('u');
                        u.textContent = selectedText;
                        range.deleteContents();
                        range.insertNode(u);
                    }
                    setMemo(textareaRef.current.innerHTML);
                }
            }
        }
    };

    // 특수문자 삽입
    const insertSymbol = (symbol: string) => {
        if (textareaRef.current) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(symbol));
                range.collapse(false);
                setMemo(textareaRef.current.innerHTML);
            }
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const latest = textareaRef.current?.innerHTML ?? draftMemoRef.current ?? memo;
            if (latest !== memo) {
                setMemo(latest);
            }
            await onSave(crewName, latest);
            setIsEditing(false);
            // 저장 후 모달을 닫지 않음
        } catch (error) {
            console.error('메모 저장 실패:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setMemo(initialMemo);
        setIsEditing(false);
        onClose();
    };

    const handleEdit = () => {
        setIsEditing(true);
        // 편집 모드 진입 시 텍스트 영역에 포커스 설정
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                // 커서를 끝으로 이동 (contentEditable용)
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(textareaRef.current);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
            }
        }, 100);
    };

    const handleCancelEdit = () => {
        setMemo(initialMemo);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (window.confirm('메모를 삭제하시겠습니까?')) {
            setIsSaving(true);
            try {
                await onSave(crewName, ''); // Save empty string to delete memo
                onClose();
            } catch (error) {
                console.error('메모 삭제 실패:', error);
                alert('메모 삭제에 실패했습니다.');
            } finally {
                setIsSaving(false);
            }
        }
    };

    // 팔레트 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if ((showTextColorPalette || showBackgroundColorPalette || showSymbolPalette) && 
                !(event.target as Element).closest('.color-palette-container') &&
                !(event.target as Element).closest('.symbol-palette-container')) {
                setShowTextColorPalette(false);
                setShowBackgroundColorPalette(false);
                setShowSymbolPalette(false);
            }
        };

        if (showTextColorPalette || showBackgroundColorPalette || showSymbolPalette) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            if (showTextColorPalette || showBackgroundColorPalette || showSymbolPalette) {
                document.removeEventListener('mousedown', handleClickOutside);
            }
        };
    }, [showTextColorPalette, showBackgroundColorPalette, showSymbolPalette]);

    if (!isOpen) {
        return null;
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        // 모달 내부의 스크롤 가능한 영역에서만 스크롤 허용
        const target = e.target as HTMLElement;
        const isScrollableArea = target.closest('[contenteditable="true"]') || 
                                 target.closest('.custom-scrollbar') ||
                                 target.closest('[style*="overflow"]') ||
                                 target.closest('.memo-content-area');
        
        // 스크롤 가능한 영역이 아니면 기본 동작 방지
        if (!isScrollableArea) {
            e.preventDefault();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-[80] p-4 pt-safe" 
            onClick={onClose}
            onTouchMove={handleTouchMove}
        >
            <div 
                ref={modalRef}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative animate-fade-in-up flex flex-col my-4 custom-scrollbar" 
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    maxHeight: '90vh', 
                    height: 'auto',
                    minHeight: 'auto'
                }}
            >
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 transition-colors"
                >
                    <XIcon className="w-6 h-6" />
                </button>
                
                <div className="flex-shrink-0 mb-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        <span className="text-blue-600 dark:text-blue-400">{crewName}</span>님 메모
                    </h2>
                </div>
                
                <div className="flex-1 min-h-0 flex flex-col">
                    {/* 툴바 */}
                    {isEditing && (
                        <div className="flex-shrink-0 border border-gray-300 dark:border-gray-600 rounded-t-lg bg-gray-50 dark:bg-gray-700 p-2 flex flex-wrap gap-1">
                            {/* 폰트 크기 */}
                            <select
                                onChange={(e) => changeFontSize(e.target.value)}
                                defaultValue="14"
                                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                title="폰트 크기"
                            >
                                <option value="8">8pt</option>
                                <option value="9">9pt</option>
                                <option value="10">10pt</option>
                                <option value="11">11pt</option>
                                <option value="12">12pt</option>
                                <option value="14">14pt</option>
                                <option value="16">16pt</option>
                                <option value="18">18pt</option>
                                <option value="20">20pt</option>
                                <option value="24">24pt</option>
                            </select>
                            
                            {/* 텍스트 색상 */}
                            <div className="relative color-palette-container">
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setShowTextColorPalette(!showTextColorPalette)}
                                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    title="텍스트 색상"
                                >
                                    A
                                </button>
                                
                                {showTextColorPalette && (
                                    <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl" style={{ zIndex: 9999, width: '140px' }}>
                                        <div className="grid grid-cols-5 gap-2 justify-items-center">
                                            {['#000000', '#FFFFFF', '#FF0000', '#00AA00', '#0066FF', '#FF6600', '#9900FF', '#00AAAA', '#FFAA00', '#AA00AA'].map((color) => (
                                                <button
                                                    key={color}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        changeTextColor(color);
                                                        setShowTextColorPalette(false);
                                                    }}
                                                    className="w-6 h-6 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                                                    style={{ backgroundColor: color }}
                                                    title={`텍스트 색상: ${color}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* 배경 색상 */}
                            <div className="relative color-palette-container">
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setShowBackgroundColorPalette(!showBackgroundColorPalette)}
                                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    title="배경 색상"
                                >
                                    🎨
                                </button>
                                
                                {showBackgroundColorPalette && (
                                    <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl" style={{ zIndex: 9999, width: '140px' }}>
                                        <div className="grid grid-cols-5 gap-2 justify-items-center">
                                            {['transparent', '#FFE6E6', '#E6F3FF', '#E6FFE6', '#FFF0E6', '#F0E6FF', '#E6FFFF', '#FFFFE6', '#FFE6F0', '#E6E6E6'].map((color) => (
                                                <button
                                                    key={color}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        changeBackgroundColor(color);
                                                        setShowBackgroundColorPalette(false);
                                                    }}
                                                    className="w-6 h-6 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:scale-110 active:scale-95 transition-transform"
                                                    style={{ backgroundColor: color }}
                                                    title={color === 'transparent' ? '배경 없음' : `배경 색상: ${color}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                            
                            {/* 볼드 */}
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={applyBold}
                                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 font-bold"
                                title="굵게"
                            >
                                B
                            </button>
                            
                            {/* 이탤릭 */}
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={applyItalic}
                                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 italic"
                                title="기울임"
                            >
                                I
                            </button>
                            
                            {/* 밑줄 */}
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={applyUnderline}
                                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 underline"
                                title="밑줄"
                            >
                                U
                            </button>
                            
                            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                            
                            {/* 특수문자 */}
                            <div className="relative symbol-palette-container">
                                <button
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setShowSymbolPalette(!showSymbolPalette)}
                                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    title="특수문자"
                                >
                                    Ω
                                </button>
                                
                                {showSymbolPalette && (
                                    <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl" style={{ zIndex: 9999, width: '140px' }}>
                                        <div className="grid grid-cols-5 gap-2 justify-items-center">
                                            {['←', '→', '↑', '↓', '↵', '●', '■', '▲', '▼', '◆'].map((symbol) => (
                                                <button
                                                    key={symbol}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        insertSymbol(symbol);
                                                        setShowSymbolPalette(false);
                                                    }}
                                                    className="w-6 h-6 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:scale-110 active:scale-95 transition-transform text-gray-900 dark:text-gray-100 font-bold"
                                                    style={{ fontSize: '13px' }}
                                                    title={`특수문자: ${symbol}`}
                                                >
                                                    {symbol}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* 목록 */}
                            <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertList(false)}
                                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                                title="목록"
                            >
                                •
                            </button>
                        </div>
                    )}
                    
                    {/* 텍스트 영역 */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        {isEditing ? (
                            <div
                        ref={textareaRef}
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                onInput={handleTextChange}
                                onKeyDown={handleKeyDown}
                                onPaste={(e) => {
                                    if (!textareaRef.current) return;
                                    e.preventDefault();
                                    const plain = e.clipboardData.getData('text/plain');
                                    const normalized = plain.replace(/\r/g, '').split('\n').map((l, i, arr) => {
                                        const next = i + 1 < arr.length ? arr[i + 1] : '';
                                        const isBlankNext = next.trim().length === 0;
                                        const isBulletNext = /^\s*(?:•|-|\d+\.|\d+\))/u.test(next);
                                        if (i < arr.length - 1) {
                                            if (l.trim().length === 0) return '';
                                            if (isBlankNext || isBulletNext) return l + '\n';
                                            return l + ' ';
                                        }
                                        return l;
                                    }).join('\n').replace(/ +/g, ' ').replace(/\n{2,}/g, '\n');
                                    const html = normalized
                                        .replace(/&/g, '&amp;')
                                        .replace(/</g, '&lt;')
                                        .replace(/>/g, '&gt;')
                                        .replace(/\n/g, '<br>');
                                    document.execCommand('insertHTML', false, html);
                                }}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onCompositionStart={handleCompositionStart}
                                onCompositionEnd={handleCompositionEnd}
                                data-placeholder="메모를 입력하세요..."
                                className="memo-content-area w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none transition-colors custom-scrollbar flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 rounded-t-none"
                                style={{ 
                                    minHeight: '150px',
                                    maxHeight: 'calc(90vh - 130px)',
                                    height: 'auto',
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-y',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    cursor: 'text',
                                    userSelect: 'text'
                                }}
                            />
                        ) : (
                            <div
                                className="memo-content-area w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg custom-scrollbar flex-1 bg-white dark:bg-gray-800 text-black dark:text-white"
                                style={{ 
                                    minHeight: '150px',
                                    maxHeight: 'calc(90vh - 130px)',
                                    height: 'auto',
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-y',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    cursor: 'default',
                                    userSelect: 'text',
                                    // 목록 항목의 자동 줄바꿈 들여쓰기
                                    textIndent: '0',
                                    paddingLeft: '0'
                                }}
                                css={`
                                    /* 목록 항목의 자동 줄바꿈 들여쓰기 */
                                    .memo-content-area {
                                        text-indent: 0;
                                        padding-left: 0;
                                        line-height: 1.5;
                                    }
                                    
                                    /* 목록 항목이 자동으로 줄바꿈될 때 들여쓰기 */
                                    .memo-content-area {
                                        /* • 기호 다음 위치까지 들여쓰기 */
                                        text-indent: -2em;
                                        padding-left: 2em;
                                        hanging-punctuation: first;
                                    }
                                    
                                    /* 첫 번째 줄은 들여쓰기 하지 않음 */
                                    .memo-content-area::first-line {
                                        text-indent: 0;
                                    }
                                    
                                    /* 목록 항목에만 적용 */
                                    .memo-content-area:has(> *:first-child:is([data-bullet])) {
                                        text-indent: -2em;
                                        padding-left: 2em;
                                    }
                                `}
                                dangerouslySetInnerHTML={{ 
                                    __html: memo && memo.length > 0 
                                        ? memo 
                                        : '<div class="text-gray-400 dark:text-gray-500 italic">메모를 입력하세요...</div>'
                                }}
                            />
                        )}
                        
                        <div className="flex-shrink-0 text-right text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {(isEditing ? editLength : memo.length)}/{MAX_LENGTH.toLocaleString()}
                        </div>
                    </div>
                </div>
                
                <div className="flex-shrink-0 flex justify-between mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleDelete}
                                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSaving || !memo.trim()}
                            >
                                삭제
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                    disabled={isSaving}
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={isSaving}
                                >
                                    {isSaving ? '저장 중...' : '저장'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex justify-center w-full">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEdit();
                                }}
                                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                                type="button"
                            >
                                편집
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CrewMemoModal;
