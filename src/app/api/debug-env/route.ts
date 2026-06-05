import { NextResponse } from 'next/server';

export async function GET() {
  const getDbg = (val: string | undefined) => {
    if (!val) return 'MISSING';
    if (val.length <= 6) return `SHORT(${val.length}): ${val}`;
    return `OK(len ${val.length}): ${val.substring(0, 3)}...${val.substring(val.length - 3)}`;
  };

  return NextResponse.json({
    GOOGLE_CLIENT_ID: getDbg(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: getDbg(process.env.GOOGLE_CLIENT_SECRET),
    AUTH_SECRET: getDbg(process.env.AUTH_SECRET),
    NEXTAUTH_SECRET: getDbg(process.env.NEXTAUTH_SECRET),
    DATABASE_URL: getDbg(process.env.DATABASE_URL),
    NEXTAUTH_URL: getDbg(process.env.NEXTAUTH_URL),
    NODE_ENV: process.env.NODE_ENV,
  });
}
