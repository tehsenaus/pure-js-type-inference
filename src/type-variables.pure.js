"use strict";

import { createTypeVariable, variableFromString, variableToString } from "./types/type-variable.pure";
import { prune, occursInType } from "./types.pure";

export const INITIAL_TYPE_VARIABLES_STATE = {
	nextId: 0,
	variables: {},
};

export const withTypeVariablesApplicative = {
	map: (f, fx) => typeVariables => {
		const [x, nextTypeVariables] = fx(typeVariables);
		return [f(x), nextTypeVariables];
	},
	ap: (ff, fx) => typeVariables => {
		const [f, intermedTypeVariables] = ff(typeVariables);
		const [x, nextTypeVariables] = fx(intermedTypeVariables);
		return [f(x), nextTypeVariables];
	},
	of: x => typeVariables => [x, typeVariables],
}

export function allocTypeVariable(typeVariables, { idString } = {}) {
	console.assert(typeVariables && typeof typeVariables.nextId === 'number');

	const nextNextId = idString ? typeVariables.nextId : typeVariables.nextId + 1;
	const id = idString ? variableFromString(idString) : typeVariables.nextId;
	const variable = createTypeVariable(id);
	return {
		variable,
		typeVariables: {
			nextId: nextNextId,
			variables: {
				...typeVariables.variables,
				[id]: variable,
			},
		},
	};
}

export function occursInTypeVariables(type, typeVariables, pruneContext = typeVariables) {
	for ( const k in typeVariables.variables ) {
		const v = typeVariables.variables[k];
		if ( occursInType(type, v, pruneContext) ) {
			return true;
		}
	}
	return false;
}

export function showTypeVariables(typeVariables, pruneContext = typeVariables) {
	return Object.keys(typeVariables.variables).map(id => {
		return '#' + variableToString(+id) + ': ' + prune(typeVariables.variables[id], pruneContext);
	}).join(', ');
}

export function getTypeVariable(variable, typeVariables) {
	console.assert(typeof variable.id === 'number');
	return typeVariables.variables[variable.id];
}

export function setTypeVariable(variable, value, typeVariables) {
	console.assert(typeof variable.id === 'number');
	return {
		...typeVariables,
		variables: {
			...typeVariables.variables,
			[variable.id]: value,
		}
	}
}
