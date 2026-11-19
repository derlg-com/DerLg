import { ArgumentsHost } from '@nestjs/common';
import { PrismaFilter } from './prisma.filter';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ErrorCode } from '../errors/error-codes';

describe('PrismaFilter', () => {
  let filter: PrismaFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
      }),
    } as unknown as ArgumentsHost;
  });

  it('maps P2002 to 409 Conflict (DUPLICATE_ENTRY)', () => {
    const error = new PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    filter.catch(error, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.DUPLICATE_ENTRY,
        message: 'This record already exists',
      },
    });
  });

  it('maps P2025 to 404 Not Found (RECORD_NOT_FOUND)', () => {
    const error = new PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    filter.catch(error, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.RECORD_NOT_FOUND,
        message: 'Record not found',
      },
    });
  });

  it('maps P2003 to 409 Conflict (CONFLICT)', () => {
    const error = new PrismaClientKnownRequestError('Foreign key failed', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    filter.catch(error, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.CONFLICT,
        message: 'Foreign key constraint failed',
      },
    });
  });

  it('maps P2023 to 400 Bad Request (VAL_INVALID_INPUT)', () => {
    const error = new PrismaClientKnownRequestError('Inconsistent column data', {
      code: 'P2023',
      clientVersion: '5.0.0',
    });
    filter.catch(error, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.VAL_INVALID_INPUT,
        message: 'Invalid input format or identifier',
      },
    });
  });

  it('maps unknown prisma error codes to 500 Internal Error', () => {
    const error = new PrismaClientKnownRequestError('Unknown error', {
      code: 'P9999',
      clientVersion: '5.0.0',
    });
    filter.catch(error, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected database error occurred',
      },
    });
  });
});
