import { CustomError as LibraryCustomError } from 'ts-custom-error';

export class CustomError extends LibraryCustomError {
  public constructor(
    public readonly code: string,
    message: string = ''
  ) {
    super(message);
  }

  public json(): object {
    return {
      code: this.code,
      message: this.message,
    };
  }
}

export class UnexpectedError extends CustomError {}

export class BusinessError extends CustomError {
  public constructor(
    code: string,
    message: string = '',
    public readonly httpCode?: number
  ) {
    super(code, message);
  }
}

export class BusinessDomainError extends BusinessError {
  public constructor(
    businessError: BusinessError,
    public readonly domain: string
  ) {
    super(businessError.code, businessError.message);
  }
}

//
// Errors definition
//

// General
export const internalServerErrorError = new UnexpectedError('internalServerError', 'internal server error');
export const unexpectedErrorError = new UnexpectedError('unexpectedError', 'unexpected error');
export const programRequestedToShutDownError = new UnexpectedError('programRequestedToShutDown', 'the program has been requested to shut down error');
export const promiseTimeoutError = new UnexpectedError('promiseTimeout', 'promise considered as timed out');
