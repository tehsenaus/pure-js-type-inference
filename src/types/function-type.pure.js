'use strict';

import { FUNCTION_TYPE } from './type-constants.pure';
import { formatBlock } from '../formatting.pure';
import { replaceInType } from '../types.pure';

/**
 * A `FunctionType` contains a `types` array. The last element represents the
 * return type. Each element before represents an argument type
 */
export function createFunctionType(types, {
	// Bound type variables (local to the function)
	typeVariables = [],
	typeClasses = [],
} = {}) {
	const allTypesDefined = types.every((t) => !!t);
	console.assert(allTypesDefined);

	// Create unique instances of each bound type variable, so when we replace (in fresh),
	// we are only replacing the variables we need to replace.
	const typeVariableReplacements = typeVariables.map(v => [v, { ...v }]);

	return {
		type: FUNCTION_TYPE,
		types: types.map(t => replaceInType(t, typeVariableReplacements)),
		typeVariables: typeVariableReplacements.map(r => r[1]),
		typeClasses,
		toString(opts = {}) {
			const { verbose = false } = opts;
			const joinedTypes = types.slice(0, -1).join(',\n');
			const args = types.length === 2 && joinedTypes.indexOf(' -> ') < 0 ? '' + types[0]
				: `(${formatBlock(joinedTypes)})`;
			const typeVars = verbose && typeVariables.length ? 'forall. ' + typeVariables.join(' ') + ' => ' : '';
			return typeVars + args + ' -> ' + types[types.length - 1].toString(opts);
		},
	};
}
