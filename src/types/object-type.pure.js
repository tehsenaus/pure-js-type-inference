'use strict';

import { OBJECT_TYPE, DICT_LOOKUP_OPERATOR } from '../types.pure';
import { STRING_TYPE } from './primitive-type.pure';

export function createObjectType(props) {
	return {
		type: OBJECT_TYPE,
		props,
		toString() {
			const stringProps = Object.keys(props).map((k) => `${k}: ${props[k]}`);
			return `{${stringProps.join(', ')}}`;
		},
	};
}

export function addObjectProperty(objectType, name, type) {
	return createObjectType({
		...objectType.props,
		[name]: type,
	});
}

export function createDictType(memberType) {
	return createObjectType({
		[DICT_LOOKUP_OPERATOR]: createFunctionType([STRING_TYPE, memberType]),
	});
}
