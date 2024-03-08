/*
 * @vinejs/vine
 *
 * (c) VineJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { AssertionError, deepEqual } from 'assert' // eslint-disable-line

import { FieldFactory } from './field.js'
import type { FieldContext, Validation } from '../src/types.js'
import { SimpleErrorReporter } from '../src/reporters/simple_error_reporter.js'

/**
 * Exposes APIs for writing validation assertions
 */
class ValidationResult {
  #outputValue: any
  #reporter: SimpleErrorReporter

  constructor(outputValue: any, reporter: SimpleErrorReporter) {
    this.#outputValue = outputValue
    this.#reporter = reporter
  }

  /**
   * Creates an assertion error instance
   */
  #assertionError(
    options: ConstructorParameters<typeof AssertionError>[0] & { showDiff?: boolean }
  ) {
    const assertion = new AssertionError(options)
    Object.defineProperty(assertion, 'showDiff', { value: true })
    return assertion
  }

  /**
   * Returns the validation result output
   */
  getOutput() {
    return this.#outputValue
  }

  /**
   * Returns an array of errors reported to the
   * error reporter
   */
  getErrors() {
    return this.#reporter.errors
  }

  /**
   * Assert one or more validation errors have occurred
   */
  assertSucceeded() {
    if (this.#reporter.hasErrors) {
      const errorsCount = this.#reporter.errors.length
      throw this.#assertionError({
        message: `Expected validation to pass. Instead failed with "${errorsCount} error(s)"`,
        operator: 'strictEqual',
        stackStartFn: this.assertSucceeded,
      })
    }
  }

  /**
   * Assert the output value of validation. The output value is
   * same as the input value, unless "mutate" method is called
   */
  assertOutput(expectedOutput: any) {
    deepEqual(this.#outputValue, expectedOutput)
  }

  /**
   * Assert one or more validation errors have occurred
   */
  assertFailed() {
    if (!this.#reporter.hasErrors) {
      throw this.#assertionError({
        message: `Expected validation to report one or more errors`,
        operator: 'strictEqual',
        stackStartFn: this.assertFailed,
      })
    }
  }

  /**
   * Assert the number of errors have occurred
   */
  assertErrorsCount(count: number) {
    const errorsCount = this.#reporter.errors.length

    if (errorsCount !== count) {
      throw this.#assertionError({
        message: `Expected validation to report "${count}" errors. Received "${errorsCount}"`,
        expected: count,
        actual: errorsCount,
        operator: 'strictEqual',
        stackStartFn: this.assertErrorsCount,
        showDiff: true,
      })
    }
  }

  /**
   * Assert error messages to include a given error message
   */
  assertError(message: string) {
    const messages = this.#reporter.errors.map((e) => e.message)

    if (!messages.includes(message)) {
      throw this.#assertionError({
        message: `Expected validation errors to include "${message}" message`,
        expected: [message],
        actual: messages,
        operator: 'includes',
        stackStartFn: this.assertError,
        showDiff: true,
      })
    }
  }
}

/**
 * Validator factory exposes the API to execute validations
 * during tests
 */
export class ValidatorFactory {
  #field?: Partial<FieldContext>
  #bail?: boolean

  constructor(field?: Partial<FieldContext>, bail?: boolean) {
    this.#field = field
    this.#bail = bail
  }

  /**
   * Creates an instance of the error reporter required
   * to report errors.
   */
  #getReporter() {
    return new SimpleErrorReporter()
  }

  /**
   * Define field context for the validation
   */
  withContext(field: Partial<FieldContext>) {
    return new ValidatorFactory(field, this.#bail)
  }

  /**
   * Toggle bail mode for the validation
   */
  bail(state: boolean) {
    return new ValidatorFactory(this.#field, state)
  }

  /**
   * Executes a validation against the provided value
   */
  execute(validation: Validation<any> | Validation<any>[], value: any) {
    const errorReporter = this.#getReporter()
    const bail = this.#bail === false ? false : true
    const field: FieldContext = {
      ...new FieldFactory().create('dummy', value, undefined, errorReporter),
      ...this.#field,
    }

    const validations = Array.isArray(validation) ? validation : [validation]
    for (let one of validations) {
      if (one.rule.isAsync) {
        throw new Error(
          `Cannot execute async rule "${one.rule.validator.name}". Use "validator.executeAsync" instead`
        )
      }

      if ((field.isDefined || one.rule.implicit) && (field.isValid || !bail)) {
        one.rule.validator(field.value, one.options, field)
      }
    }

    return new ValidationResult(field.value, errorReporter)
  }

  /**
   * Executes an async validation against the provided
   * value
   */
  async executeAsync(validation: Validation<any> | Validation<any>[], value: any) {
    const errorReporter = this.#getReporter()
    const bail = this.#bail === false ? false : true
    const field: FieldContext = {
      ...new FieldFactory().create('dummy', value, undefined, errorReporter),
      ...this.#field,
    }

    const validations = Array.isArray(validation) ? validation : [validation]
    for (let one of validations) {
      if ((field.isDefined || one.rule.implicit) && (field.isValid || !bail)) {
        await one.rule.validator(field.value, one.options, field)
      }
    }

    return new ValidationResult(field.value, errorReporter)
  }
}
