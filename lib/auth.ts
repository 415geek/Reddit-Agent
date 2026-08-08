import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return new TextEncoder().encode(secret)
}

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
  const token = cookies().get('mv_token')?.value
  if (!token) return null
  try { return await verifyToken(token) } catch { return null }
}
