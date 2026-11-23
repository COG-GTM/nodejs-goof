import 'express-session';

export interface UploadedFile {
  name: string;
  data: Buffer;
  mimetype: string;
  mv(path: string, callback: (err?: Error) => void): void;
}

declare module 'express-session' {
  interface SessionData {
    loggedIn: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      files?: { [field: string]: UploadedFile };
    }
  }
}
