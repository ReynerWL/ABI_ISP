import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  it('should be defined', () => {
    const mockLogService = { log: jest.fn() };
    const mockReflector = { get: jest.fn() };
    const interceptor = new LoggingInterceptor(mockLogService as any, mockReflector as any);
    expect(interceptor).toBeDefined();
  });
});
