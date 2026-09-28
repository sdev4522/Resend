export interface ApiResponse<T = any> {
  success: boolean;
  msg?: string;
  message?: string;
  data?: T;
  err?: any;
  error?: string;
  logout?: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number;
  page?: number;
  limit?: number;
}

export class ApiError extends Error {
  status: number;
  data?: any;
  logout?: boolean;

  constructor(message: string, status = 500, data?: any, logout = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.logout = logout;
  }
}
