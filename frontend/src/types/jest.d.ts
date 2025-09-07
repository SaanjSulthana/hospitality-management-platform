import '@testing-library/jest-dom';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveAttribute(attr: string, value?: string): R;
    }
  }
}

declare global {
  var jest: any;
  var describe: any;
  var it: any;
  var expect: any;
  var beforeEach: any;
  var afterEach: any;
  var beforeAll: any;
  var afterAll: any;
  var test: any;
  var xit: any;
  var xdescribe: any;
  var fit: any;
  var fdescribe: any;
}
