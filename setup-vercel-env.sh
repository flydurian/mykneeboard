#!/bin/bash

# Vercel 환경변수 설정 스크립트
# 사용법: ./setup-vercel-env.sh

echo "🔧 Vercel 환경변수 설정을 시작합니다..."
echo ""
echo "⚠️  주의: 이 스크립트를 실행하기 전에 각 API 키를 발급받아야 합니다."
echo ""

# Vercel CLI 설치 확인
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI가 설치되어 있지 않습니다."
    echo "다음 명령어로 설치하세요: npm install -g vercel"
    exit 1
fi

# 환경변수 입력 받기
echo "📋 환경변수를 입력하세요 (Enter 키를 누르면 건너뜁니다):"
echo ""

read -p "RAPIDAPI_KEY (AeroDataBox): " RAPIDAPI_KEY
read -p "INCHEON_API_KEY (인천공항): " INCHEON_API_KEY
read -p "CHECKWX_API_KEY (METAR/TAF): " CHECKWX_API_KEY
read -p "OPENWEATHER_API_KEY (날씨): " OPENWEATHER_API_KEY
read -p "AQICN_API_KEY (대기질): " AQICN_API_KEY
read -p "EXCHANGE_API_KEY (환율): " EXCHANGE_API_KEY

echo ""
echo "🚀 Vercel 환경변수를 설정합니다..."
echo ""

# 환경변수 설정 (입력된 것만)
if [ ! -z "$RAPIDAPI_KEY" ]; then
    echo "✅ RAPIDAPI_KEY 설정 중..."
    vercel env add RAPIDAPI_KEY production <<< "$RAPIDAPI_KEY"
    vercel env add RAPIDAPI_KEY preview <<< "$RAPIDAPI_KEY"
    vercel env add RAPIDAPI_KEY development <<< "$RAPIDAPI_KEY"
fi

if [ ! -z "$INCHEON_API_KEY" ]; then
    echo "✅ INCHEON_API_KEY 설정 중..."
    vercel env add INCHEON_API_KEY production <<< "$INCHEON_API_KEY"
    vercel env add INCHEON_API_KEY preview <<< "$INCHEON_API_KEY"
    vercel env add INCHEON_API_KEY development <<< "$INCHEON_API_KEY"
fi

if [ ! -z "$CHECKWX_API_KEY" ]; then
    echo "✅ CHECKWX_API_KEY 설정 중..."
    vercel env add CHECKWX_API_KEY production <<< "$CHECKWX_API_KEY"
    vercel env add CHECKWX_API_KEY preview <<< "$CHECKWX_API_KEY"
    vercel env add CHECKWX_API_KEY development <<< "$CHECKWX_API_KEY"
fi

if [ ! -z "$OPENWEATHER_API_KEY" ]; then
    echo "✅ OPENWEATHER_API_KEY 설정 중..."
    vercel env add OPENWEATHER_API_KEY production <<< "$OPENWEATHER_API_KEY"
    vercel env add OPENWEATHER_API_KEY preview <<< "$OPENWEATHER_API_KEY"
    vercel env add OPENWEATHER_API_KEY development <<< "$OPENWEATHER_API_KEY"
fi

if [ ! -z "$AQICN_API_KEY" ]; then
    echo "✅ AQICN_API_KEY 설정 중..."
    vercel env add AQICN_API_KEY production <<< "$AQICN_API_KEY"
    vercel env add AQICN_API_KEY preview <<< "$AQICN_API_KEY"
    vercel env add AQICN_API_KEY development <<< "$AQICN_API_KEY"
fi

if [ ! -z "$EXCHANGE_API_KEY" ]; then
    echo "✅ EXCHANGE_API_KEY 설정 중..."
    vercel env add EXCHANGE_API_KEY production <<< "$EXCHANGE_API_KEY"
    vercel env add EXCHANGE_API_KEY preview <<< "$EXCHANGE_API_KEY"
    vercel env add EXCHANGE_API_KEY development <<< "$EXCHANGE_API_KEY"
fi

echo ""
echo "✅ 환경변수 설정이 완료되었습니다!"
echo ""
echo "🔄 이제 Vercel에 재배포하세요:"
echo "   vercel --prod"
echo ""

