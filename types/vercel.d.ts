declare module '@vercel/node' {
  export interface VercelRequest extends Request {
    body?: any;
    query?: any;
  }

  export interface VercelResponse extends Response {
    status(code: number): VercelResponse;
    json(data: any): VercelResponse;
  }
}
