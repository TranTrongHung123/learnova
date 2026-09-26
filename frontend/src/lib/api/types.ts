export type FieldError = { field: string; message: string };
export type ApiProblem = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  fieldErrors: FieldError[];
};
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type HealthResponse = { status: "UP" };
