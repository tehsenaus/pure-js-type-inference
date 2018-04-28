'use strict';

import { ARRAY_LOOKUP_OPERATOR, PRIMITIVE_TYPE } from './type-constants.pure';
import { createTypeVariable } from './type-variable.pure';
import { createFunctionType } from './function-type.pure';
import { createObjectType } from './object-type.pure';
import { NUMBER_TYPE, INDETERMINATE_TYPE } from './primitive-type.pure';
import { createNullableType } from './nullable-type.pure';
import { prune } from '../types.pure';

export function createArrayType(elementTypeOptional) {
	const elementTypeIsVariable = !elementType;
	const elementType = elementTypeOptional || createTypeVariable(0, { bound: true });

	const lookupTypeVariables = elementTypeIsVariable ? [] : [elementType];
	const lookup = createFunctionType(
		[NUMBER_TYPE, createNullableType(elementType)],
		{ typeVariables: lookupTypeVariables }
	);

	const reduceResultType = elementTypeIsVariable
		? createTypeVariable(1, { bound: true })
		: createTypeVariable(0, { bound: true });
	const reduceTypeVariables = elementTypeIsVariable
		? [elementType, reduceResultType]
		: [reduceResultType];
	const reduce = createFunctionType(
		[
			createFunctionType([reduceResultType, elementType, NUMBER_TYPE, reduceResultType]),
			reduceResultType,
			reduceResultType,
		],
		{ typeVariables: reduceTypeVariables }
	);

	return createObjectType({
		length: NUMBER_TYPE,
		[ARRAY_LOOKUP_OPERATOR]: lookup,
		reduce,
	});
}

export function createTupleType(elementTypes, typeVariables) {
	console.assert(typeVariables);

	const elementType = elementTypes.length
		? elementTypes.reduce((t1, t2) => commonSubtype(t1, t2, typeVariables))
		: null;

	return createObjectType({
		...createArrayType(elementType).props,
		...elementTypes.reduce((elementProps, elementType, i) => {
			return {
				...elementProps,
				[i]: elementType,
			};
		}, {}),
	});
}

function commonSubtype(t1Raw, t2Raw, typeVariables) {
	console.assert(typeVariables);

	const t1 = prune(t1Raw, typeVariables);
	const t2 = prune(t2Raw, typeVariables);

	const hasCommonPrimitiveType
		= t1.type === PRIMITIVE_TYPE
		&& t2.type === PRIMITIVE_TYPE
		&& t1.primitiveType === t2.primitiveType;

	if (hasCommonPrimitiveType) {
		return t1;
	}

	return INDETERMINATE_TYPE;
}
