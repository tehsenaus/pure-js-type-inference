"use strict";

import * as babylon from 'babylon';
import traverse from 'babel-traverse';
import { prune, unify, allocTypeVariable, createFunctionType, createObjectType,
	NUMBER_TYPE, STRING_TYPE, INITIAL_TYPE_VARIABLES_STATE, UNIT_TYPE, OBJECT_TYPE,
	BOOLEAN_TYPE, createArrayType, createTupleType, commonSubtype, fresh, showTypeVariables, isDictType, createDictType, DICT_LOOKUP_OPERATOR,
} from './types.pure';
import { mapWithState, reduceWithState, mapWithStateTakeLast } from './util.pure';
import { throwNiceError } from './error.pure';
import { analyseFunction } from './inference/function.pure';
import { analyseMemberExpression } from './inference/member-expression.pure';

export function analyseCall(funType, args, state) {
	const [freshFunType, freshTypeVariables] = fresh(funType, state.typeVariables);
	const { variable: resultTypeVariable, typeVariables } = allocTypeVariable(freshTypeVariables);
	const stateWithVar = {
		...state,
		typeVariables,
	};

	const { result: argTypes, nextState } =
		args.length ? mapWithState(stateWithVar, args, analyse)
			: { result: [UNIT_TYPE], nextState: stateWithVar };

	const types = [
		...argTypes,
		resultTypeVariable
	];
	const callType = createFunctionType(types);
	const [freshCallType, freshCallTypeVariables] = fresh(callType, nextState.typeVariables);

	try {
		// console.log('unifyCall: %s && %s', freshCallType, freshFunType)
		const [unifiedCallType, unifiedFunType, nextTypeVariables]
			= unify(callType, freshFunType, freshCallTypeVariables);

		const unifiedResultType = unifiedCallType.types[argTypes.length];

		return {
			result: unifiedResultType,
			state: {
				...nextState,
				typeVariables: nextTypeVariables,
			},
		};
	} catch (e) {
		throw new TypeError('Bad call!' +
			'\nWas expecting: ' + prune(funType, nextState.typeVariables) +
			'\n ...but given: ' + prune(callType, nextState.typeVariables) +
			'\nRoot cause: ' + e + '\n' + (e.stack || '') + '\n');
	}
}

export function analyse(node, state) {
	console.assert(node);
	try {
		return _analyse(node, state);
	} catch (e) {
		throwNiceError(e, state.src, node);
	}
}

export function _analyse(node, state) {
	console.assert(state);

	switch (node.type) {
	case 'ExpressionStatement': {
		return analyse(node.expression, state);
	}

	case 'FunctionExpression':
	case 'ArrowFunctionExpression': {
		return analyseFunction(node, state, analyse);
	}

	case 'FunctionDeclaration': {
		const name = node.id.name;

		const { result, state: nextState } = analyseFunction(node, state, analyse);

		return {
			result,
			state: {
				...nextState,
				env: {
					...state.env,
					[name]: result,
				},
			},
		};
	}

	case 'VariableDeclaration': {
		return mapWithStateTakeLast(state, node.declarations, analyse);
	}
	case 'VariableDeclarator': {
		const { result: type, state: nextState } = analyse(node.init, state);
		return {
			result: UNIT_TYPE,
			state: {
				...nextState,
				env: {
					...nextState.env,
					[node.id.name]: type,
				}
			}
		};
	}

	case 'CallExpression': {
		const { result: calleeType, state: nextState } = analyse(node.callee, state);
		return analyseCall(calleeType, node.arguments, nextState);
	}

	case 'UnaryExpression': {
		const args = [node.argument];
		const name = `${node.operator}`;

		if (!(name in state.env)) {
			throw "unknown identifier: " + name;
		}

		return analyseCall(state.env[name], args, state);
	}

	case 'BinaryExpression': {
		const args = [node.left, node.right];
		const name = `(${node.operator})`;

		if (!(name in state.env)) {
			throw "unknown identifier: " + name;
		}

		return analyseCall(state.env[name], args, state);
	}

	case 'ConditionalExpression': {
		const { result: testType, state: stateWithTest } = analyse(node.test, state);
		const [unifiedTestType, boolType, typeVariables] = unify(testType, BOOLEAN_TYPE, stateWithTest.typeVariables);

		const { result: consType, state: stateWithCons } = analyse(node.consequent, stateWithTest);
		const { result: altType, state: nextState } = analyse(node.alternate, stateWithTest);

		const [unifiedConsType, unifiedAltType, nextTypeVariables] = unify(consType, altType, nextState.typeVariables);

		return {
			result: unifiedConsType,
			state: {
				...nextState,
				typeVariables: nextTypeVariables,
			}
		};
	}

	case 'ObjectExpression': {
		// Empty object - create a dict type (supporting dynamic lookup)
		if (node.properties.length === 0) {
			const { variable: memberType, typeVariables } = allocTypeVariable(state.typeVariables);
			return {
				result: createDictType(memberType),
				state: {
					...state,
					typeVariables,
				},
			};
		}

		const { result: types, nextState } = reduceWithState(state, node.properties, (props, p, state) => {
			switch (p.type) {
			case 'ObjectProperty': {
				const { result: memberType, state: nextState } = analyse(p.value, state);

				// If we are creating dynamic properties, then the object becomes a dict.
				if (p.computed) {
					const [unifiedDictType, unifiedType, typeVariables] = unify(
						createDictType(memberType),
						createObjectType(props),
						state.typeVariables
					);

					return {
						result: {
							...props,
							...unifiedDictType.props,
						},
						state: {
							...nextState,
							typeVariables,
						},
					};
				}

				return {
					result: {
						...props,
						[p.key.name || p.key.value]: memberType,
					},
					state: nextState,
				};
			}

			case 'SpreadProperty': {
				const { result: type, state: nextState } = analyse(p.argument, state);

				// If this is a known object type, we know its properties.
				if ( type.type === OBJECT_TYPE && !isDictType(type) ) {
					return {
						result: {
							...props,
							...type.props,
						},
						state: nextState,
					};
				}

				// Otherwise, this is a dynamic spread.
				console.log(props);
				const { variable: memberType, typeVariables }
					= props[DICT_LOOKUP_OPERATOR] ? { variable: props[DICT_LOOKUP_OPERATOR], typeVariables: nextState.typeVariables }
						: allocTypeVariable(nextState.typeVariables);
				const [unifiedDictType, unifiedType, nextTypeVariables] = unify(
					createDictType(memberType),
					type,
					typeVariables
				);

				return {
					result: {
						...props,
						...unifiedDictType.props,
					},
					state: {
						...nextState,
						typeVariables: nextTypeVariables,
					},
				};
			}

			default:
				throw 'unknown property type in ObjectExpression: ' + p.type;
			}
		}, {});

		const result = createObjectType(types);

		return {
			result,
			state: {
				...nextState,
			},
		};
	}

	case 'ArrayExpression': {
		const { result: elementTypes, nextState } = mapWithState(state, node.elements, analyse);

		return {
			result: createTupleType(elementTypes, nextState.typeVariables),
			state: nextState,
		}
	}

	case 'MemberExpression': {
		return analyseMemberExpression(node, state, analyse);
	}

	case 'ReturnStatement': {
		return analyse(node.argument, state);
	}

	case 'Identifier': {
		if ( node.name in state.env ) {
			return {
				result: state.env[node.name],
				state,
			};
		} else {
			console.error(node.name, state.env);
			throw "unknown identifier: " + node.name;
		}
	}

	case 'NumericLiteral': {
		return {
			result: NUMBER_TYPE,
			state,
		}
	}
	case 'StringLiteral': {
		return {
			result: STRING_TYPE,
			state,
		}
	}
	case 'BooleanLiteral': {
		return {
			result: BOOLEAN_TYPE,
			state,
		}
	}

	case 'Program':
	case 'BlockStatement': {
		const { result: bodyTypes, nextState } = mapWithState(state, node.body, analyse);

		const returnType = bodyTypes.filter((t, i) => node.body[i].type === 'ReturnStatement')[0];

		return {
			// TODO: blocks technically have void type
			result: returnType || UNIT_TYPE,
			state: nextState,
		};
	}

	case 'EmptyStatement': {
		return {
			result: UNIT_TYPE,
			state,
		}
	}

	default: {
		throw 'unknown AST node type: ' + node.type;
	}
	}
}

const { variable, typeVariables } = allocTypeVariable(INITIAL_TYPE_VARIABLES_STATE);
const globalEnv = {
	'(+)': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE, NUMBER_TYPE ]),
	'(-)': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE, NUMBER_TYPE ]),
	'(<)': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE, BOOLEAN_TYPE ]),
	'-': createFunctionType([ NUMBER_TYPE, NUMBER_TYPE ]),
	'!': createFunctionType([ variable, BOOLEAN_TYPE ])
}
const initialState = {
	env: globalEnv,
	typeVariables,
}

const parseOptions = {
	plugins: ['objectRestSpread'],
};

export function analyseSource(src) {
	const wrappedSrc = `(() => { ${src} })()`;
	const ast = babylon.parse(wrappedSrc, parseOptions);
	const res = analyse(ast.program.body[0], { ...initialState, src: wrappedSrc });

	console.log('RESULT = %s', prune(res.result, res.state.typeVariables));

	const vars = res.state.typeVariables.variables;
	console.log(showTypeVariables(res.state.typeVariables));

	return res.result;
}

// analyseSource(`return m => x => x[m]`);

// analyseSource(`return (state, values, f, initial) => {
// 	return values.reduce((acc, v, i) => {
// 		const r = f(acc.result, v, acc.nextState, i);
// 		return { result: r.result, nextState: r.state };
// 	}, { result: initial, nextState: state });
// }`);

// analyseSource(`
// const mapWithState = (state, values, f, initial) => {
// 	return values.reduce((acc, v, i) => {
// 		const r = f(acc.result, v, acc.nextState, i);
// 		return { result: r.result, nextState: r.state };
// 	}, { result: initial, nextState: state });
// };
// return mapWithState({}, [1, 2], (acc, v, state, i) => ({ result: {}, state: {} }), {});
// `);

// analyseSource(`return (state, values, f, initial) => {
// 	return values.reduce(({ result: acc, nextState: state }, v, i) => {
// 		const { result, state: nextState } = f(acc, v, state, i);
// 		return { result, nextState };
// 	}, { result: initial, nextState: state });
// }`);

// analyseSource(`return (s => ({ ...s, c: 1 }))({ ['y']: 1 })['x']`);
// analyseSource(`return { ...{ ['x']: true }, ...{ ['y']: 1 } }`);

