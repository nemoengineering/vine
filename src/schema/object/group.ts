/*
 * @vinejs/vine
 *
 * (c) VineJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { ObjectGroupNode, RefsStore } from '@vinejs/compiler/types'

import { messages } from '../../defaults.js'
import { GroupConditional } from './conditional.js'
import { ITYPE, OTYPE, COTYPE, PARSE } from '../../symbols.js'
import type { ParserOptions, UnionNoMatchCallback } from '../../types.js'

/**
 * Object group represents a group with multiple conditionals, where each
 * condition returns a set of object properties to merge into the
 * existing object.
 */
export class ObjectGroup<Conditional extends GroupConditional<any, any, any, any>> {
  declare [ITYPE]: Conditional[typeof ITYPE];
  declare [OTYPE]: Conditional[typeof OTYPE];
  declare [COTYPE]: Conditional[typeof COTYPE]

  #conditionals: Conditional[]
  #otherwiseCallback: UnionNoMatchCallback<Record<string, unknown>> = (_, field) => {
    field.report(messages.unionGroup, 'unionGroup', field)
  }

  constructor(conditionals: Conditional[]) {
    this.#conditionals = conditionals
  }

  /**
   * Clones the ObjectGroup schema type.
   */
  clone(): this {
    const cloned = new ObjectGroup<Conditional>(this.#conditionals)
    cloned.otherwise(this.#otherwiseCallback)
    return cloned as this
  }

  /**
   * Define a fallback method to invoke when all of the group conditions
   * fail. You may use this method to report an error.
   */
  otherwise(callback: UnionNoMatchCallback<Record<string, unknown>>): this {
    this.#otherwiseCallback = callback
    return this
  }

  /**
   * Compiles the group
   */
  [PARSE](refs: RefsStore, options: ParserOptions): ObjectGroupNode {
    return {
      type: 'group',
      elseConditionalFnRefId: refs.trackConditional(this.#otherwiseCallback),
      conditions: this.#conditionals.map((conditional) => conditional[PARSE](refs, options)),
    }
  }
}
