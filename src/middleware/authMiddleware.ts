import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  role: string;
  iat?: number;
  exp?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;

  console.log('Verifying token:', token ? 'Token present' : 'No token');

  if (!token) {
    console.log('No token found in cookies');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: jwt.VerifyErrors | null, decoded: unknown) => {
    if (err || !decoded) {
      console.log('Token verification failed:', (err as any)?.message || 'no decoded');
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }

    const payload = decoded as TokenPayload;
    console.log('Token verified successfully for user:', payload.userId);
    req.user = payload;
    next();
  });
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admins only' });
  }
  next();
};
