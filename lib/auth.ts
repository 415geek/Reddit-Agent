import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const AUTH_COOKIE = 'bb_token'

const getSecret = () => new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me')

export async function signToken(payload: Record<string, string>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret())
  return payload
}

export async function getSession() {
  const token = cookies().get(AUTH_COOKIE)?.value
  if (!token) return null
  try { return await verifyToken(token) } catch { return null }
}
