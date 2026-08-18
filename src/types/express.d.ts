declare namespace Express {
  interface Request {
    adminUser?: {
      uid: string;
      email: string;
    };
  }
}
