export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, 'bad_request', details);
export const unauthorized = (message = 'Нужно войти в аккаунт') =>
  new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'Недостаточно прав') =>
  new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Не найдено') => new HttpError(404, message, 'not_found');
export const conflict = (message: string) => new HttpError(409, message, 'conflict');
