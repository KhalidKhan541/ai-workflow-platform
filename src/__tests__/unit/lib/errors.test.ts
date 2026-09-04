import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  WorkflowExecutionError,
  AIClientError,
  TimeoutError,
  isAppError,
  toAppError,
} from '@/lib/errors';

describe('Error Handling', () => {
  describe('AppError', () => {
    it('should create an error with defaults', () => {
      const error = new AppError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom values', () => {
      const error = new AppError('Custom', 400, 'CUSTOM_CODE', false, { detail: 'info' });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.isOperational).toBe(false);
      expect(error.details).toEqual({ detail: 'info' });
    });

    it('should serialize to JSON', () => {
      const error = new AppError('Test', 422, 'TEST');
      const json = error.toJSON();
      expect(json.statusCode).toBe(422);
      expect(json.code).toBe('TEST');
      expect(json.message).toBe('Test');
    });

    it('should be instanceof Error', () => {
      const error = new AppError('test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ValidationError', () => {
    it('should have 400 status', () => {
      const error = new ValidationError('Invalid input', { email: ['Invalid email'] });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ email: ['Invalid email'] });
    });
  });

  describe('AuthenticationError', () => {
    it('should have 401 status and default message', () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.message).toBe('Authentication required');
    });

    it('should accept custom message', () => {
      const error = new AuthenticationError('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('AuthorizationError', () => {
    it('should have 403 status', () => {
      const error = new AuthorizationError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('NotFoundError', () => {
    it('should format message with resource and id', () => {
      const error = new NotFoundError('Workflow', 'wf-1');
      expect(error.message).toContain('Workflow');
      expect(error.message).toContain('wf-1');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should handle missing id', () => {
      const error = new NotFoundError('Workflow');
      expect(error.message).toContain('Workflow');
      expect(error.message).not.toContain('undefined');
    });
  });

  describe('ConflictError', () => {
    it('should have 409 status', () => {
      const error = new ConflictError('Already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('RateLimitError', () => {
    it('should have 429 status and retryAfter', () => {
      const error = new RateLimitError(30);
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.retryAfter).toBe(30);
    });

    it('should default retryAfter to 60', () => {
      const error = new RateLimitError();
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('WorkflowExecutionError', () => {
    it('should include stepId and workflowId', () => {
      const error = new WorkflowExecutionError('Step failed', 'step-1', 'wf-1');
      expect(error.stepId).toBe('step-1');
      expect(error.workflowId).toBe('wf-1');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('WORKFLOW_EXECUTION_ERROR');
    });
  });

  describe('AIClientError', () => {
    it('should include provider and model', () => {
      const error = new AIClientError('API error', 'openai', 'gpt-4');
      expect(error.provider).toBe('openai');
      expect(error.model).toBe('gpt-4');
      expect(error.statusCode).toBe(502);
    });
  });

  describe('TimeoutError', () => {
    it('should include timeoutMs', () => {
      const error = new TimeoutError('API call', 5000);
      expect(error.timeoutMs).toBe(5000);
      expect(error.statusCode).toBe(504);
      expect(error.code).toBe('TIMEOUT');
    });
  });

  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('test'))).toBe(true);
      expect(isAppError(new ValidationError('test'))).toBe(true);
      expect(isAppError(new NotFoundError('test'))).toBe(true);
    });

    it('should return false for non-AppError', () => {
      expect(isAppError(new Error('test'))).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError('string')).toBe(false);
    });
  });

  describe('toAppError', () => {
    it('should return AppError as-is', () => {
      const error = new AppError('test');
      expect(toAppError(error)).toBe(error);
    });

    it('should convert Error to AppError', () => {
      const error = new Error('regular error');
      const appError = toAppError(error);
      expect(appError).toBeInstanceOf(AppError);
      expect(appError.message).toBe('regular error');
      expect(appError.isOperational).toBe(false);
    });

    it('should convert unknown to AppError', () => {
      const error = toAppError('string error');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('string error');
    });

    it('should convert number to AppError', () => {
      const error = toAppError(42);
      expect(error.message).toBe('42');
    });
  });

  describe('error inheritance', () => {
    it('all custom errors extend AppError', () => {
      expect(new ValidationError('')).toBeInstanceOf(AppError);
      expect(new AuthenticationError()).toBeInstanceOf(AppError);
      expect(new AuthorizationError()).toBeInstanceOf(AppError);
      expect(new NotFoundError('x')).toBeInstanceOf(AppError);
      expect(new ConflictError('x')).toBeInstanceOf(AppError);
      expect(new RateLimitError()).toBeInstanceOf(AppError);
      expect(new WorkflowExecutionError('x')).toBeInstanceOf(AppError);
      expect(new AIClientError('x', 'y')).toBeInstanceOf(AppError);
      expect(new TimeoutError('x', 1)).toBeInstanceOf(AppError);
    });
  });
});
