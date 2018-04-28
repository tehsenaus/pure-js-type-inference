"use strict";

import { mapWithState, reduceWithState } from './util.pure';
import {FUNCTION_TYPE, OBJECT_TYPE, PRIMITIVE_TYPE, NULLABLE_TYPE,
	INDETERMINATE_TYPE_NAME, TYPE_VARIABLE} from './types/type-constants.pure';
import {allocTypeVariable} from './type-variables.pure';
import { createFunctionType } from './types/function-type.pure';
import { createObjectType } from './types/object-type.pure';
import { createNullableType } from './types/nullable-type.pure';
import { indent } from './formatting.pure';

/**
 * Based on: https://github.com/puffnfresh/roy/blob/master/src/types.js
 */

export * from './types/type-constants.pure';
export * from './types/type-variable.pure';
export * from './types/primitive-type.pure';
export * from './types/nullable-type.pure';
export * from './types/function-type.pure';
export * from './types/object-type.pure';
export * from './types/array-type.pure';
export * from './type-variables.pure';


// function createTypeClass(name, type) {
//     this.name = name;
//     this.type = type;
//     this.types = [type];
// };
// TypeClassType.prototype = new BaseType();
// TypeClassType.prototype.fresh = function(nonGeneric, mappings) {
//     if(!mappings) mappings = {};
//     return new TypeClassType(this.name, this.type.fresh(nonGeneric, mappings));
// };
// TypeClassType.prototype.toString = function() {
//     return this.name + ' ' + this.type.toString();
// };
// exports.TypeClassType = TypeClassType;


/**
 * Creates an instance of the type with all bound type variables from functions 'instantiated'
 * to appear as type variables in the given context.
 * 
 * This is done when a function is called.
 */
export function fresh(rawType, typeVariables) {
	const type = prune(rawType, typeVariables);
	console.assert(typeVariables);

	switch (type.type) {
	case FUNCTION_TYPE: {
		const { result: freshVariableReplacements, nextState: freshTypeVariables } = reduceWithState(
			typeVariables,
			type.typeVariables,
			(replacements, variableToReplace, typeVariables) => {
				const {
					variable: freshVariable,
					typeVariables: nextTypeVariables
				} = allocTypeVariable(typeVariables);

				// Replace bound variable with fresh instance

				return {
					result: {
						...replacements,
						[variableToReplace.id]: freshVariable,
					},
					state: nextTypeVariables,
				};
			},
			{}
		);

		const { result: freshTypes, nextState: nextTypeVariables } = mapWithState(
			freshTypeVariables,
			type.types,
			(t, typeVariables, i) => {
				const replaced = replaceInType(t, freshVariableReplacements);

				const isReturnType = i === type.types.length - 1;
				const [freshType, state] = !isReturnType ? fresh(
					replaced,
					typeVariables
				) : [replaced, typeVariables];

				return { result: freshType, state };
			}
		)

		return [
			createFunctionType(freshTypes),
			nextTypeVariables
		];
	}
	case OBJECT_TYPE: {
		const { result: freshProps, nextState: nextTypeVariables } = reduceWithState(
			typeVariables,
			Object.keys(type.props),
			(props, k, typeVariables) => {
				const prop = type.props[k];
				const [freshProp, nextTypeVariables] = fresh(prop, typeVariables);
				return {
					result: freshProp === prop ? props : {
						...props,
						[k]: freshProp,
					},
					state: nextTypeVariables,
				};
			},
			type.props
		);
		return [
			freshProps === type.props ? type : createObjectType(freshProps),
			nextTypeVariables
		];
	}
	case NULLABLE_TYPE: {
		const [underlyingType, nextTypeVariables] = fresh(type.underlyingType, typeVariables);
		return [createNullableType(underlyingType), nextTypeVariables];
	}
	case TYPE_VARIABLE:
	case PRIMITIVE_TYPE:
	case INDETERMINATE_TYPE_NAME:
		return [type, typeVariables];
	}
	throw new Error("fresh: invalid type: " + type.type);
}

// reduceA : (Applicative F) => (r -> a -> r) -> [F a] -> F r
// map : (r -> a -> r) -> F r -> F (a -> r)
// ap : F (a -> r) -> F a -> F r
// of : a -> F a
const reduceA = ({ map, ap, of }) => (f, init) => actions =>
	actions.reduce(
		(fr, fa, i) => ap(map(r => a => f(r, a, i), fr), fa),
		of(init)
	);

// sequenceA : (Applicative F) => [F r] -> F [r]
const sequenceA = applicative => reduceA(applicative)((rs, r) => [...rs, r], []);

export const traverseType = (applicative) => (f) => {
	const {map} = applicative;
	const sequence = sequenceA(applicative);
	const reduce = reduceA(applicative);
	const traverse = (type) => {
		switch (type.type) {
		case FUNCTION_TYPE: {
			const result = sequence(type.types.map(traverse));
			return map(types => createFunctionType(types, type), result);
		}
		case OBJECT_TYPE: {
			const keys = Object.keys(type.props);
			const result = reduce(
				(props, newProp, i) => {
					const k = keys[i];
					const prop = type.props[k];
					return newProp === prop ? props : {
						...props,
						[k]: newProp,
					};
				},
				type.props
			)(
				keys.map(k => traverse(type.props[k]))
			);

			return map(
				replacedProps => replacedProps === type.props ? type : createObjectType(replacedProps),
				result
			);
		}
		case TYPE_VARIABLE:
		case PRIMITIVE_TYPE:
		case INDETERMINATE_TYPE_NAME:
			return f(type);
		case NULLABLE_TYPE:
			return map(createNullableType, traverse(type.underlyingType))
		}
		throw new Error("traverseType: invalid type: " + type.type);
	};
	return traverse;
}

const identityApplicative = {
	map: (f, x) => f(x),
	ap: (f, a) => f(a),
	of: x => x,
}

const constApplicative = {
	map: (f, x) => x,
	ap: (a, b) => a.concat(b),
	of: x => [],
}

export const getAllTypeVariablesInType = traverseType(constApplicative)(type => {
	switch (type.type) {
	case TYPE_VARIABLE: {
		return type.bound ? [] : [type];
	}
	}
	return [];
});

export const replaceInType = (t, replacements) => traverseType(identityApplicative)(type => {
	switch (type.type) {
	case TYPE_VARIABLE: {
		if ( type.id in replacements ) {
			return replacements[type.id];
		}
	}
	}
	return type;
})(t);

// ### Prune
//
// This will unchain variables until it gets to a type or variable without an
// instance. See `unify` for some details about type variable instances.
export function prune(type, typeVariables) {
	console.assert(typeVariables);

	switch (type.type) {
	case TYPE_VARIABLE: {
		if ( type.bound ) {
			return type;
		}
		const pruned = typeVariables.variables[type.id];
		if ( pruned.id === type.id ) {
			return pruned;
		}
		return prune(pruned, typeVariables);
	}
	case FUNCTION_TYPE: {
		return createFunctionType(type.types.map(t => prune(t, typeVariables)), type);
	}
	case OBJECT_TYPE: {
		const prunedProps = Object.keys(type.props).reduce((props, k) => {
			const prop = type.props[k];
			const prunedProp = prune(prop, typeVariables);
			return prunedProp === prop ? props : {
				...props,
				[k]: prunedProp,
			};
		}, type.props);
		return prunedProps === type.props ? type : createObjectType(prunedProps);
	}
	case PRIMITIVE_TYPE:
	case INDETERMINATE_TYPE_NAME:
		return type;
	case NULLABLE_TYPE:
		return createNullableType(prune(type.underlyingType, typeVariables));
	}
	throw new Error("prune: invalid type: " + type.type);
};

// ### Unification
// This is the process of finding a type that satisfies some given constraints. In this system, unification will try to satisfy that either:

// t1 and t2 are equal type variables
// t1 and t2 are equal types
// In case #1, if t1 is a type variable and t2 is not currently equal, unification will set t1 to have an instance of t2. When t1 is pruned, it will unchain to a type without an instance.

// In case #2, do a deep unification on the type, using recursion.

// If neither constraint can be met, the process will throw an error message.
export function unify(t1Raw, t2Raw, typeVariables) {
	console.assert(typeVariables);

	const t1 = prune(t1Raw, typeVariables);
	const t2 = prune(t2Raw, typeVariables);

	// console.log('unify', t1Raw, t2Raw, t1, t2, typeVariables);
    
	if (t2.type === INDETERMINATE_TYPE_NAME) {
		return [t1, t2, typeVariables];
	}

	if (t1.type === TYPE_VARIABLE) {
		console.assert(t2);

		if (t1 !== t2) {
			if (occursInType(t1, t2, typeVariables)) {
				throw "Cannot construct infinite type: " + t1 + ' ~ ' + t2;
			}
			// t1.instance = t2;
		}
		const unified = (t2.type !== TYPE_VARIABLE || t2.id < t1.id) ? t2 : t1;
		return [unified, unified, {
			...typeVariables,
			variables: {
				...typeVariables.variables,
				[t1.id]: unified,
				[t2.id]: unified,
			},
		}];
	} else if (t2.type === TYPE_VARIABLE) {
		if (occursInType(t2, t1, typeVariables)) {
			throw "Cannot construct infinite type: " + t1 + ' ~ ' + t2;
		}
		const unified = t1;
		return [unified, unified, {
			...typeVariables,
			variables: {
				...typeVariables.variables,
				[t2.id]: unified,
			},
		}];
	} else if (t1.type === FUNCTION_TYPE && t2.type === FUNCTION_TYPE) {
		if (t1.name != t2.name || t1.types.length != t2.types.length) {
			throw "Type error: " + t1.toString() + " is not " + t2.toString();
		}
		const { result: unifiedTypes, nextState: nextTypeVariables } = mapWithState(
			typeVariables,
			t1.types.slice(0, t2.types.length),
			(t, typeVariables, i) => {
				const [t1u, t2u, state] = unify(t, t2.types[i], typeVariables);
				return {
					result: [t1u, t2u],
					state,
				};
			}
		);

		return [
			{
				...t1,
				types: t1.types.map((t, i) => i < unifiedTypes.length ? unifiedTypes[i][0] : t),
			}, {
				...t2,
				types: t2.types.map((t, i) => i < unifiedTypes.length ? unifiedTypes[i][1] : t),
			},
			nextTypeVariables
		];
	} else if (t1.type === PRIMITIVE_TYPE && t2.type === PRIMITIVE_TYPE && t1.primitiveType === t2.primitiveType) {
		return [t1, t2, typeVariables];
	} else if (t1.type === OBJECT_TYPE && t2.type === OBJECT_TYPE) {
		const t1keys = Object.keys(t1.props);
		const t2keys = Object.keys(t2.props);
		const keysSet = new Set([...t1keys, ...t2keys]);

		// t1 may be a subtype of t2, in which case it may have more keys.
		if ( keysSet.size === t1keys.length ) {
			// unify every key in t2 with the corresponding t1 key.
			const { result: unifiedTypes, nextState: nextTypeVariables } = mapWithState(
				typeVariables,
				t2keys,
				(k, typeVariables, i) => {
					const [t1u, t2u, state] = unify(t1.props[k], t2.props[k], typeVariables);
					return {
						result: [t1u, t2u],
						state,
					};
				}
			);

			return [t1, t2, nextTypeVariables];
		} else {
			const missingProps = t2keys
				.filter(k => !(k in t1.props))
				.map(k => k + ' : ' + prune(t2.props[k], typeVariables));
			throw new TypeError("Object missing properties:\n" + indent(missingProps.join('\n')));
		}
	}

	console.log(t1, t2);
	throw new TypeError("Not unified: " + t1 + ' && ' + t2);
}


// ### Occurs check

// These functions check whether the type `t2` is equal to or contained within
// the type `t1`. Used for checking recursive definitions in `unify` and
// checking if a variable is non-generic in `fresh`.

export function occursInType(t1, t2Raw, typeVariables) {
	const t2 = prune(t2Raw, typeVariables);
	if (t2 === t1) {
		return true;
	}
	switch (t2.type) {
	case FUNCTION_TYPE: {
		return occursInTypeArray(t1, t2.types, typeVariables);
	}
	case OBJECT_TYPE: {
		for ( const k in t2.props ) {
			if ( occursInType(t1, t2.props[k], typeVariables) ) {
				return true;
			}
		}
		return false;
	}
	case NULLABLE_TYPE:
		return occursInType(t1, t2.underlyingType, typeVariables);
	case TYPE_VARIABLE:
	case PRIMITIVE_TYPE:
	case INDETERMINATE_TYPE_NAME:
		return false;
	}
	throw "occursInType: invalid type: " + t2.type;
}

export function occursInTypeArray(t1, types, typeVariables) {
	return types.some(t2 => occursInType(t1, t2, typeVariables));
}
