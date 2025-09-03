import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tokenResponse = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': process.env.AMADEUS_CLIENT_ID || '',
        'client_secret': process.env.AMADEUS_CLIENT_SECRET || ''
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Amadeus 인증 오류: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    
    return response.status(200).json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in
    });

  } catch (error) {
    console.error('Amadeus 토큰 가져오기 오류:', error);
    return response.status(500).json({ 
      error: 'Amadeus API 인증에 실패했습니다.' 
    });
  }
}
