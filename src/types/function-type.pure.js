"use strict";

import { FUNCTION_TYPE } from './type-constants.pure';
import { formatBlock } from '../formatting.pure';

/**
 * A `FunctionType` contains a `types` array. The last element represents the
 * return type. Each element before represents an argument type
 */
export function createFunctionType(types, {
	// Bound type variables (local to the function)
	typeVariables = [],

	typeClasses = [],
} = {}) {
	console.assert(types.every(t => !!t));
	return {
		type: FUNCTION_TYPE,
		types,
		typeVariables,
		typeClasses,
		toString() {
			const joinedTypes = types.slice(0,-1).join(',\n');
			const args = types.length === 2 && joinedTypes.indexOf(' -> ') < 0 ? '' + types[0]
				: `(${formatBlock(joinedTypes)})`;
			const typeVars = ''; // typeVariables.length ? 'forall. ' + typeVariables.join(' ') + ' => ' : '';
			return typeVars + args + ' -> ' + types[types.length - 1];
		}
	};
}
